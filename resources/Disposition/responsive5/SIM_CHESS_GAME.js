var GameChess = (function($) {

const app = window.$app;
let ctn, board, data, player, game, ews, pieces;

// called from SIM_CHESS_GAME
async function install() {
    if (!window.ChessBoard)
        await loadLibs();
    startGame();
}

async function loadLibs() {
    // Load the ZIP file
    const { JSZip } = await $factory.JSZip();
    const bytes = await (await fetch(app.getResourceURL("SIM_CHESSBOARD", "SET"))).arrayBuffer();
    const zip = await JSZip.loadAsync(bytes);

    // Piece images in /img directory
    pieces = Object.fromEntries(await Promise.all(
        zip.file(/img\/[bw][kqrbnp]\.png$/i).map(async f =>
            [f.name.replace(/^.*\/|\.png$/g, ""), URL.createObjectURL(await f.async("blob"))])
    ));

    // Styles
    $('<style type="text/css" id="chessboard-css"/>')
        .text(await zip.file("chessboard.min.css").async("text"))
        .appendTo("head");

    // Chess engine + board UI
    $factory.globalEval(await zip.file("chess.min.js").async("text"));
    $factory.globalEval(await zip.file("chessboard.min.js").async("text"));

    await $factory.loadCSS({ url: app.getResourceURL("SIM_CHESS_STYLES", "CSS") });
}

function startGame() {
    let saved = app.sysparams.GAME_CHESS;

    function begin(c) {
        if (saved === "empty")
            saved = null;
        try { saved = JSON.parse(saved); }
        catch { /* not JSON */ }
        load(c, saved, {
            login: $grant.login,
            name: [$grant.firstname, $grant.lastname].filter(Boolean).join(" ") || $grant.login,
            userId: $grant.userid,
            image: $grant.picture?.id ?? null
        });
    }
    function end() {
        save();
        destroy();
    }

    // Splitter mode: open the game in its own closeable work-area tab
    const area = $view.splitter.isEnabled()
        && $view.splitter.request({ name: "simplichess", title: "Chess", position: "right" });
    if (area) {
        $ui.contentUnload(area); // unload previous one
        const c = $('<div class="js-content-unload"/>').css("max-width", 460).on("ui.content.unload", end);
        area.empty().append(c);
        begin(c);
        return;
    }

    // Mono work area: side dialog
    const vw = $(window).width() || 0;
    const width = vw < 400 ? vw : 400;
    const c = $('<div/>').width(width - 35);
    $tools.dialog({
        name: "chess",
        content: c,
        width,
        slide: "right",
        onload() { begin(c); },
        unload: end
    });
}

function display() {
    return $('<div class="game-chess"/>')
        .append($('<div id="chess-board" class="board"/>'))
        .append($('<div class="chess-info"/>'))
        .append($('<div class="bar"/>')
            .append($tools.button({ name:"newgame", level:"primary",   size:"xs", label:"New game", click:newGame }))
            .append($tools.button({ name:"back",    level:"secondary", size:"xs", label:"Back" }))
            .append($tools.button({ name:"hint",    level:"secondary", size:"xs", label:"Hint" }))
            .append($tools.button({ name:"replay",  level:"secondary", size:"xs", label:"Replay", click:replay }))
            .append($tools.button({ name:"flip",    level:"secondary", size:"xs", label:"Flip", click:flip } )))
        .append($('<div class="move-history"/>'));
}

function load(c, d, p) {
    init(c, d, p);
    save();
}

function reload(d) {
    init(null, d, player);
}

function init(c, d, p) {
    data = d = d || {};
    player = p;
    d.white = d.white || player;
    d.black = d.black || { name:"ai" };
    d.level = d.level == null ? bot.getLevel() : d.level;
    bot.setLevel(d.level);

    // Websocket
    if (!ews) {
        ews = $ui.ews;
        ews?.bind("updateObject", onUpdate);
    }

    // Load game
    game = new Chess();
    if (d.pgn)
        game.load_pgn(d.pgn);
    else if (d.board)
        game.load(d.board);

    game.header('White', d.white.name || "");
    game.header('Black', d.black.name || "");
    p.orientation = p.orientation || "white";

    // Update UI board
    c = c || ctn.parent();
    ctn = display();
    c.html(ctn);
    board = ChessBoard("chess-board", {
        draggable: true,
        position: d.board || "start",
        orientation: p.orientation,
        pieceTheme: p => pieces[p],
        onDragStart: onDragStart,
        onDrop: onDrop,
        onMouseoutSquare: onMouseoutSquare,
        onMouseoverSquare: onMouseoverSquare,
        onSnapEnd: onSnapEnd
    });

    tglButtons();
    showHistory();
    showPlayers();
    next();
}

function getData() {
    return {
        board: game.fen(),
        turn: game.turn(),
        white: data.white,
        black: data.black,
        level: data.level,
        pgn: game.pgn()
    };
}

function save() {
    app.setSysParam(null, "GAME_CHESS", getData(), true);
}

function reset() {
    game?.reset();
    board?.start();
    showHistory();
}

function destroy() {
    game?.clear();
    board?.destroy();
    game = board = null;
    ews && ews.unbind("updateObject", onUpdate);
}

function refresh() {
    try {
        board?.position(game.fen());
        showHistory();
    }
    catch(e) {}
}

function flip() {
    board.flip();
    player.orientation = board.orientation();
    save();
}

function move(m) {
    game.move(m);
    board.position(game.fen());
    showHistory();
}

function isBotTurn() {
    return (game.turn()=="w" && data.white.name=="ai") || (game.turn()=="b" && data.black.name=="ai");
}
function isPlayerTurn() {
    return (game.turn()=="w" ? data.white : data.black).login == player.login;
}

function hint() {
    isPlayerTurn() && runBot();
}

function back() {
    const moves = game.history();
    if (moves.length>0) {
        game.undo();
        isBotTurn() && game.undo();
        refresh();
    }
}

function replay() {
    const moves = game.history(),
        fen = game.fen();
    freeze(true);
    reset();
    setTimeout(function() {
        (function fn(i) {
            if (i<moves.length) {
                move(moves[i]);
                setTimeout(function() { fn(i+1); }, 1000);
            }
            else {
                board.position(fen);
                freeze(false);
            }
        })(0);
    }, 500);
}

function isGameOver(silent) {
    let over = false;
    !silent && msg();
    if (game.in_checkmate()) {
        !silent && msg("Checkmate!");
        over = true;
    }
    //else if (game.in_draw()) {
        //!silent && msg("Draw!", "The game is drawn! 50-move rule or insufficient material.");
        //over = true;
    //}
    else if (game.insufficient_material()) {
        !silent && msg("Draw!", "The game is drawn! insufficient material.");
        over = true;
    }
    else if (game.in_threefold_repetition()) {
        !silent && msg("Draw!", "The game is drawn! threefold repetition.");
        over = true;
    }
    else if (game.in_stalemate()) {
        !silent && msg("Stalemate!", "The game is stalemated! King has no possible move.");
        over = true;
    }
    else if (game.in_check()) {
        !silent && msg("Check!");
    }
    return over;
}

function next() {
    if (game) {
        $(".chess-info .player", ctn).removeClass("turn");
        $(".chess-info .player."+(game.turn()=="w" ? "white" : "black")).addClass("turn");

        // Bot turn ?
        if (!isGameOver() && isBotTurn())
            runBot();
    }
}

function onUpdate(m) {
    let v;
    try {
        v = m.data.usp_value;
        reload(JSON.parse(v));
    }
    catch(e) {
        console.error("WebSocket onUpdate error: " + v, e);
    }
}

function newGame() {
    $('.new-game',ctn).remove();
    const player2 = $('<input type="text" class="player2"/>').hide();

    // Computer strength picker, shown inline whenever a side is set to "Computer"
    const aiLevels = ["Beginner", "Casual", "Intermediate", "Skilled", "Advanced", "Expert"],
        aiLevel = $('<select class="form-control ai-level"/>');
    aiLevels.forEach(function(n, i) {
        aiLevel.append($('<option/>').attr("value", i).text(i + " - " + n).prop("selected", i == bot.getLevel()));
    });
    const aiLevelRow = $('<div class="form-control ai-level-row"/>').hide()
        .append($('<label/>').text("Computer level"))
        .append(aiLevel);

    let d, p1 = {}, p2 = {};
    function start() {
        const v1 = $("[name='p1']:checked",d).val(),
            v2 = $("[name='p2']:checked",d).val();
        p1 = v1=="me" ? player : (v1=="ai" ? { name:"ai" } : p1);
        p2 = v2=="me" ? player : (v2=="ai" ? { name:"ai" } : p2);
        if (!(p1.name && p2.name && (p1==player || (p1.name=="ai" && (p2==player || p2.name=="ai"))))) {
            alert("Please select 2 players");
            return;
        }
        destroy();
        reload({ white:p1, black:p2, level: parseInt(aiLevel.val(), 10) });
        save();
        close();
    }

    function close() {
        d.slideUp(function() {
            d.remove();
            $(".move-history").show();
        });
    }

    d = $('<div class="new-game"/>')
        .hide().appendTo(ctn)
        .append($('<label/>').text("Player 1 (white)"))
        .append($('<div class="form-control"/>')
            .append($('<div class="checkbox"/>')
                .append($('<label>')
                    .append($('<input type="radio" name="p1" value="me"/>').prop("checked", true))
                    .append(player.name)))
            .append($('<div class="checkbox"/>')
                .append($('<label>')
                    .append($('<input type="radio" name="p1" value="ai"/>'))
                    .append("Computer"))))
        .append($('<label/>').text("Player 2 (black)"))
        .append($('<div class="form-control"/>')
            .append($('<div class="checkbox"/>')
                .append($('<label>')
                    .append($('<input type="radio" name="p2" value="me"/>'))
                    .append(player.name)))
            .append($('<div class="checkbox"/>')
                .append($('<label>')
                    .append($('<input type="radio" name="p2" value="ai"/>').prop("checked", true))
                    .append("Computer")))
            .append($('<div class="checkbox"/>')
                .append($('<label>')
                    .append($('<input type="radio" name="p2" value="co"/>'))
                    .append("Colleague"))
                    .append(player2)))
        .append(aiLevelRow)
        .append($tools.button({ name:"start",  level:"primary",   size:"xs", label:"Start",  click:start }))
        .append($tools.button({ name:"cancel", level:"secondary", size:"xs", label:"Cancel", click:close }));

    function syncPanel() {
        const v1 = $("[name='p1']:checked",d).val(),
            v2 = $("[name='p2']:checked",d).val();
        v2=="co" ? player2.show() : player2.hide();
        aiLevelRow.toggle(v1=="ai" || v2=="ai");
    }
    $("[name='p1'],[name='p2']",d).on("change", syncPanel);
    syncPanel();

    function completion(p,x) {
        $ui.view.widget.completion(p, 20,
            function(cbk) {
                app.follow(function(r) {
                    r && cbk(r.authors);
                },{
                    method: "search",
                    param: p.val()
                });
            },
            function(u) {
                if (u) {
                    x.name = u.fullName;
                    x.login = u.login;
                    x.userId = u.userId;
                    x.image = u.image;
                    p.val(u.fullName);
                }
            },
            function(u) {
                return $('<div/>')
                .append($ui.view.widget.avatar(u))
                .append($('<span/>').text(u.fullName))
            });
    }
    completion(player2, p2);
    $(".move-history").hide();
    d.slideDown();
}

function tglButtons() {
    const b = $(".btn-back,.btn-hint",ctn).off("click");
    if ((data.white.name=="ai" && data.black.name=="ai") || (data.white.name!="ai" && data.black.name!="ai")) {
        b.hide();
    }
    else {
        b.show();
        $(".btn-back",ctn).on("click", back);
        $(".btn-hint",ctn).on("click", hint);
    }
}

function showHistory() {
    const h = $('.move-history',ctn).empty(),
        moves = game.history();
    for (let i=0; i<moves.length; i+=2)
        h.append('<span><b>' + (Math.floor(i/2)+1) +".</b> "+ moves[i] + ' ' + (moves[i+1] || '') + '</span>');
    h.scrollTop(h[0].scrollHeight);
}

function showPlayers() {
    $(".chess-info",ctn).empty()
        .append($('<div class="player white"/>')
            .append($ui.view.icon("far/circle", "icon off"))
            .append($ui.view.icon("far/arrow-alt-circle-right", "icon on"))
            .append($ui.view.widget.avatar(data.white))
            .append("white: " + data.white.name)
            .append('<div class="msg"/>'))
        .append($('<div class="player black"/>')
            .append($ui.view.icon("far/circle", "icon off"))
            .append($ui.view.icon("far/arrow-alt-circle-right", "icon on"))
            .append($ui.view.widget.avatar(data.black))
            .append("black: " + data.black.name)
            .append('<div class="msg"/>'))
        .append(data.white.name=="ai" || data.black.name=="ai" ? '<div class="stats"/>' : '');
}

function alert(m) {
    $ui.alert(m);
}

function msg(m,a) {
    $(".player .msg", ctn).hide().text("");
    if (m) {
        const c = game.turn()=="w" ? "white" : "black";
        m && $(".player."+c+" .msg", ctn).text(m).fadeIn();
    }
    a && alert(a);
}

function onDragStart(source, piece, position, orientation) {
    const t = game.turn();
    if ((t=="w" && piece.search(/^b/)!==-1)
     || (t=="b" && piece.search(/^w/)!==-1)
     || !isPlayerTurn()
     || isGameOver(true))
        return false;
}

function onDrop(source, target) {
    const move = game.move({
        from: source,
        to: target,
        promotion: "q"
    });
    removeGreySquares();
    if (!move)
        return "snapback";
    showHistory();
    board.position(game.fen(), false);
    save();
    next();
}

function onSnapEnd() {
    board.position(game.fen());
}

function onMouseoverSquare(square, piece) {
    if (isPlayerTurn()) {
        const moves = game.moves({ square:square, verbose:true });
        if (moves.length) {
            greySquare(square);
            for (let i=0; i<moves.length; i++)
                greySquare(moves[i].to);
        }
    }
}

function onMouseoutSquare(square, piece) {
    removeGreySquares();
}

function removeGreySquares() {
    $('.board .square-55d63', ctn).css("background","");
}

function greySquare(square) {
    const s = $('.board .square-'+square, ctn);
    s.css("background", s.hasClass("black-3c85d") ? "#696969" : "#a9a9a9");
}

function freeze(b) {
    setTimeout(function() {
        if (b)
            $(".btn",ctn).attr("disabled","disabled");
        else
            $(".btn",ctn).removeAttr("disabled");
    }, 0);
}

function runBot() {
    freeze(true);
    let released = false;
    const release = () => { if (!released) { released = true; freeze(false); } };
    setTimeout(function() {
        try {
            bot.run(release);
        }
        catch (e) {
            // Never leave the board frozen with the buttons disabled, and surface the stack
            console.error("Chess bot failed", e);
            release();
        }
    }, 300);
}

// BOT: remote chess service, with a local negamax engine as fallback
class ChessBot {
    _count = 0;
    _level = 2; // difficulty: 0=beginner .. 5=expert (drives both the remote search depth and the local engine)
    _useQuiesce = true;
    _remoteDown = false;

	run(cbk) {
		// Try the remote service once; after any failure fall back to the local engine for good
		if (this._remoteDown)
			return this._fallback(null, cbk);

        // Best move from back-end service. Search depth follows the selected difficulty level.
		// Public external object endpoint /ext is granted to EASTER_EGG group
		const depth = ChessBot._LEVELS[ChessBot._clampLevel(this._level)].depth;
		const u = app.getExternalObjectURL("SimGameChess", {
			format: "san",
			depth,
			fen: game.fen()
		}, true).replace("/ui/ext/", "/ext/");

        $.ajax({
			url: u,
			dataType: "json"
		})
		.done(r => {
			if (r && r.move) {
				$(".stats",ctn).text("Depth: "+r.depth+" - Pos: "+r.pos+" - Time: "+(r.time/1000)+"s - Pos/sec:"+(Math.round(r.pos*1000/r.time)));
				this._done(r.move);
				cbk();
			}
			else
				this._fallback("External object SimGameChess error", cbk);
		})
		.fail(() => this._fallback("External object SimGameChess not available", cbk));
	}

    _fallback(msg, cbk) {
        if (msg && !this._remoteDown)
            console.error(msg + " - switching to the local engine");
        this._remoteDown = true;
        try {
            this._done(this._getBestMove());
        }
        catch (e) {
            console.error("Local chess engine error", e);
        }
        finally {
            cbk(); // always release the freeze
        }
    }

    _done(bestMove) {
        if (!bestMove)
            return;
        if (!game.move(bestMove)) {
            console.error("Chess bot produced an illegal move:", bestMove, "in", game.fen());
            return;
        }
        board.position(game.fen());
        showHistory();
        save();
        next();
    }

    // Local heuristic engine (fallback when the chess service is unavailable).
    // Strength is driven by `_level`: 0=beginner .. 5=expert.
    static _INF = 99999;
    static _MATE = 90000;
    static _ABORT = {};   // thrown to unwind the search when the time budget is spent
    _stopAt = 0;          // wall-clock deadline (ms) for the current search

    // Per level: nominal search depth, whether to run a quiescence search,
    // blunder = probability of playing a random legal move (human-like mistakes),
    // margin = how far (eval points, ~10 = a pawn) from the best score a move
    // may be and still be played, maxMs = soft time budget per move.
    static _LEVELS = [
        { name:"Beginner",     depth:1, quiesce:false, blunder:1.00, margin:9999, maxMs:100  },
        { name:"Casual",       depth:2, quiesce:false, blunder:0.40, margin:25,   maxMs:400  },
        { name:"Intermediate", depth:2, quiesce:true,  blunder:0.12, margin:12,   maxMs:800  },
        { name:"Skilled",      depth:3, quiesce:true,  blunder:0.04, margin:6,    maxMs:1400 },
        { name:"Advanced",     depth:4, quiesce:true,  blunder:0.00, margin:2,    maxMs:2200 },
        { name:"Expert",       depth:5, quiesce:true,  blunder:0.00, margin:0,    maxMs:3500 }
    ];

    static _clampLevel(n) {
        n = parseInt(n, 10);
        return isNaN(n) ? 2 : Math.max(0, Math.min(ChessBot._LEVELS.length - 1, n));
    }
    setLevel(n) { this._level = ChessBot._clampLevel(n); }
    getLevel() { return this._level; }

    _getBestMove() {
        if (!game || isGameOver(true))
            return;
        this._count = 0;
        const cfg = ChessBot._LEVELS[ChessBot._clampLevel(this._level)];
        this._useQuiesce = cfg.quiesce;
        const t0 = new Date().getTime();
        let scored, doneDepth = 0;
        this._stopAt = t0 + cfg.maxMs;
        // Iterative deepening: on timeout we keep the last fully searched depth.
        for (let d = 1; d <= cfg.depth; d++) {
            const res = this._searchRoot(d);
            if (res) { scored = res; doneDepth = d; }
            if (new Date().getTime() > this._stopAt)
                break;
        }
        if (!scored || !scored.length) {
            // Time budget spent before any depth finished: just play a legal move
            const legal = game.moves();
            return legal[Math.floor(Math.random() * legal.length)];
        }
        scored.sort(function(a, b) { return b.score - a.score; });

        let pick;
        if (cfg.blunder && Math.random() < cfg.blunder) {
            // Human-like mistake: any legal move
            pick = scored[Math.floor(Math.random() * scored.length)];
        }
        else {
            // Randomise among the moves within `margin` of the best score
            const best = scored[0].score,
                pool = scored.filter(function(x) { return best - x.score <= cfg.margin; });
            pick = pool[Math.floor(Math.random() * pool.length)];
        }
        pick = pick || scored[0]; // guard against NaN scores emptying the pool

        const t = (new Date().getTime() - t0) / 1000,
            pps = t ? Math.round(this._count / t) : this._count;
        $(".stats", ctn).text("Lvl " + this._level + " (" + cfg.name + ") - Depth: " + doneDepth +
            " - Pos: " + this._count + " - Time: " + t + "s - Pos/sec:" + pps);
        return pick.move;
    }

    static _PIECE_BASE = { p:10, n:30, b:30, r:50, q:90, k:900 };

    // Move ordering straight from the SAN string (cheap: no verbose move gen).
    // Checkmate first, then captures (cheapest attacker first), promotions,
    // checks, castling. Good ordering is what makes alpha/beta actually prune.
    static _sanScore(s) {
        if (s.indexOf("#") !== -1)
            return 100000;
        let v = 0;
        const c = s.charAt(0);
        if (s.indexOf("x") !== -1)
            v += 10 - (c >= "A" && c <= "Z" ? (ChessBot._PIECE_BASE[c.toLowerCase()] || 0) / 10 : 0.1);
        if (s.indexOf("=") !== -1)
            v += 9;
        if (s.indexOf("+") !== -1)
            v += 0.5;
        if (s.charAt(0) === "O")
            v += 0.3;
        return v;
    }
    static _orderMoves(moves) {
        moves.sort(function(a, b) { return ChessBot._sanScore(b) - ChessBot._sanScore(a); });
        return moves;
    }

    // Static score relative to the side to move
    static _evalRelative() {
        const e = ChessBot._evaluateBoard();
        return game.turn() == "w" ? e : -e;
    }

    // Quiescence: past the depth limit, keep searching only "loud" moves
    // (captures / promotions, plus every reply while in check) so the engine
    // never scores a position in the middle of a trade or a check. `q` caps
    // the extra depth so it always terminates.
    _qsearch(alpha, beta, q, ply) {
        if ((++this._count & 2047) === 0 && new Date().getTime() > this._stopAt)
            throw ChessBot._ABORT;
        let moves = game.moves(), s;
        if (!moves.length)
            return game.in_check() ? -(ChessBot._MATE - ply) : 0;
        const inCheck = game.in_check();
        if (!inCheck) {
            s = ChessBot._evalRelative(); // stand pat
            if (s >= beta)
                return beta;
            if (s > alpha)
                alpha = s;
            if (q <= 0)
                return alpha;
            moves = moves.filter(function(m) { return m.indexOf("x") !== -1 || m.indexOf("=") !== -1; });
        }
        else if (q <= 0)
            return ChessBot._evalRelative();
        ChessBot._orderMoves(moves);
        for (let i=0; i<moves.length; i++) {
            game.move(moves[i]);
            s = -this._qsearch(-beta, -alpha, q - 1, ply + 1);
            game.undo();
            if (s >= beta)
                return beta;
            if (s > alpha)
                alpha = s;
        }
        return alpha;
    }

    // Negamax with alpha/beta pruning. `ply` lets shorter mates score higher.
    _negamax(depth, alpha, beta, ply) {
        if ((++this._count & 2047) === 0 && new Date().getTime() > this._stopAt)
            throw ChessBot._ABORT;
        const moves = game.moves(); // SAN strings: far cheaper than verbose
        if (!moves.length) // no legal move: checkmate or stalemate
            return game.in_check() ? -(ChessBot._MATE - ply) : 0;
        if (depth <= 0)
            return this._useQuiesce ? this._qsearch(alpha, beta, 6, ply) : ChessBot._evalRelative();
        ChessBot._orderMoves(moves);
        for (let i=0; i<moves.length; i++) {
            game.move(moves[i]);
            const s = -this._negamax(depth - 1, -beta, -alpha, ply + 1);
            game.undo();
            if (s >= beta)
                return beta;
            if (s > alpha)
                alpha = s;
        }
        return alpha;
    }

    // Root search: returns [{ move, score }] (SAN) for every legal move,
    // scored from the moving side's point of view (higher is better). Every
    // move gets a full window so the scores are exact -- the level logic needs
    // real gaps between moves to pick "near best" or blunder convincingly.
    _searchRoot(depth) {
        const moves = ChessBot._orderMoves(game.moves()), out = [],
            base = game.history().length;
        for (let i=0; i<moves.length; i++) {
            if (i > 0 && new Date().getTime() > this._stopAt)
                return null; // incomplete: caller keeps the previous depth
            let s;
            try {
                game.move(moves[i]);
                s = -this._negamax(depth - 1, -ChessBot._INF, ChessBot._INF, 1);
                game.undo();
            }
            catch (e) {
                while (game.history().length > base) game.undo(); // restore the board first
                if (e !== ChessBot._ABORT) throw e;
                return null;
            }
            out.push({ move: moves[i], score: s });
        }
        return out;
    }

    // --- Static evaluation, white's point of view (~10 points per pawn) ---
    // Material + piece-square tables + pawn structure (doubled / isolated /
    // passed) + rook files + rook on 7th + minor-piece development + bishop
    // pair + king pawn-shield + tempo. Two cheap 8x8 passes, no move generation.
    static _evaluateBoard() {
        const b = game.board(),
            wpawns = [0,0,0,0,0,0,0,0], bpawns = [0,0,0,0,0,0,0,0];
        let sc = 0, wbishop = 0, bbishop = 0, phase = 0,
            wkFile = 4, bkFile = 4, wkRow = 7, bkRow = 0;

        // First pass: pawn files, bishop count, king position, game phase
        for (let i=0; i<8; i++)
            for (let j=0; j<8; j++) {
                const pc = b[i][j];
                if (!pc) continue;
                if (pc.type == "p")
                    (pc.color == "w" ? wpawns : bpawns)[j]++;
                else if (pc.type == "b") { pc.color == "w" ? wbishop++ : bbishop++; phase += 1; }
                else if (pc.type == "n") phase += 1;
                else if (pc.type == "r") phase += 2;
                else if (pc.type == "q") phase += 4;
                else if (pc.type == "k") {
                    if (pc.color == "w") { wkFile = j; wkRow = i; }
                    else { bkFile = j; bkRow = i; }
                }
            }
        const endgame = phase <= 6;

        // Second pass: material, piece-square tables, structure, development
        for (let i=0; i<8; i++)
            for (let j=0; j<8; j++) {
                const pc = b[i][j];
                if (!pc) continue;
                const w = pc.color == "w";
                let v = ChessBot._pieceSquareValue(pc.type, w, i, j, endgame);
                if (pc.type == "p") {
                    const own = w ? wpawns : bpawns,
                        opp = w ? bpawns : wpawns;
                    let passed = true;
                    if (own[j] > 1)
                        v -= 0.5; // doubled
                    if ((j == 0 || own[j-1] == 0) && (j == 7 || own[j+1] == 0))
                        v -= 0.5; // isolated
                    for (let k = j-1; k <= j+1; k++)
                        if (k >= 0 && k < 8 && opp[k] > 0)
                            passed = false;
                    if (passed)
                        v += endgame ? 1.5 : 0.5; // passed pawn
                }
                else if (pc.type == "r") {
                    if (wpawns[j] == 0 && bpawns[j] == 0)
                        v += 0.5; // open file
                    else if ((w ? wpawns : bpawns)[j] == 0)
                        v += 0.25; // half-open file
                    if (!endgame && i == (w ? 1 : 6))
                        v += 0.3; // rook on the 7th
                }
                else if (!endgame && (pc.type == "n" || pc.type == "b") && i == (w ? 7 : 0))
                    v -= 0.4; // undeveloped minor piece
                sc += w ? v : -v;
            }

        if (wbishop >= 2) sc += 0.5; // bishop pair
        if (bbishop >= 2) sc -= 0.5;

        if (!endgame) {
            // Pawn shield: friendly pawns on the files around the king
            sc += ChessBot._shield(wpawns, wkFile) - ChessBot._shield(bpawns, bkFile);
            // Keep the king home (castling leaves it on its back rank; a king
            // that has walked off it in the middlegame is asking for trouble)
            if (wkRow != 7) sc -= 0.6;
            if (bkRow != 0) sc += 0.6;
        }

        sc += game.turn() == "w" ? 0.1 : -0.1; // tempo

        return sc;
    }

    static _shield(pawns, file) {
        let s = 0;
        for (let k = file-1; k <= file+1; k++)
            if (k >= 0 && k < 8)
                s += pawns[k] > 0 ? 0.15 : -0.2;
        return s;
    }

    static _rev(a) {
        return a.slice().reverse();
    }

    static _pawnEvalWhite = [
            [ 0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, 0.0 ],
            [ 5.0,  5.0,  5.0,  5.0,  5.0,  5.0,  5.0, 5.0 ],
            [ 1.0,  1.0,  2.0,  3.0,  3.0,  2.0,  1.0, 1.0 ],
            [ 0.5,  0.5,  1.0,  2.5,  2.5,  1.0,  0.5, 0.5 ],
            [ 0.0,  0.0,  0.0,  2.0,  2.0,  0.0,  0.0, 0.0 ],
            [ 0.5, -0.5, -1.0,  0.0,  0.0, -1.0, -0.5, 0.5 ],
            [ 0.5,  1.0,  1.0, -2.0, -2.0,  1.0,  1.0, 0.5 ],
            [ 0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, 0.0 ]
        ];
    static _pawnEvalBlack = ChessBot._rev(ChessBot._pawnEvalWhite);
    static _knightEval = [
            [ -5.0, -4.0, -3.0, -3.0, -3.0, -3.0, -4.0, -5.0 ],
            [ -4.0, -2.0,  0.0,  0.0,  0.0,  0.0, -2.0, -4.0 ],
            [ -3.0,  0.0,  1.0,  1.5,  1.5,  1.0,  0.0, -3.0 ],
            [ -3.0,  0.5,  1.5,  2.0,  2.0,  1.5,  0.5, -3.0 ],
            [ -3.0,  0.0,  1.5,  2.0,  2.0,  1.5,  0.0, -3.0 ],
            [ -3.0,  0.5,  1.0,  1.5,  1.5,  1.0,  0.5, -3.0 ],
            [ -4.0, -2.0,  0.0,  0.5,  0.5,  0.0, -2.0, -4.0 ],
            [ -5.0, -4.0, -3.0, -3.0, -3.0, -3.0, -4.0, -5.0 ]
        ];
    static _bishopEvalWhite = [
            [ -2.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -2.0 ],
            [ -1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -1.0 ],
            [ -1.0,  0.0,  0.5,  1.0,  1.0,  0.5,  0.0, -1.0 ],
            [ -1.0,  0.5,  0.5,  1.0,  1.0,  0.5,  0.5, -1.0 ],
            [ -1.0,  0.0,  1.0,  1.0,  1.0,  1.0,  0.0, -1.0 ],
            [ -1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0, -1.0 ],
            [ -1.0,  0.5,  0.0,  0.0,  0.0,  0.0,  0.5, -1.0 ],
            [ -2.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -2.0 ]
        ];
    static _bishopEvalBlack = ChessBot._rev(ChessBot._bishopEvalWhite);
    static _rookEvalWhite = [
            [  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,  0.0 ],
            [  0.5, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,  0.5 ],
            [ -0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.5 ],
            [ -0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.5 ],
            [ -0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.5 ],
            [ -0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.5 ],
            [ -0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.5 ],
            [  0.0, 0.0, 0.0, 0.5, 0.5, 0.0, 0.0,  0.0 ]
        ];
    static _rookEvalBlack = ChessBot._rev(ChessBot._rookEvalWhite);
    static _queenEval = [
            [ -2.0, -1.0, -1.0, -0.5, -0.5, -1.0, -1.0, -2.0 ],
            [ -1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -1.0 ],
            [ -1.0,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -1.0 ],
            [ -0.5,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -0.5 ],
            [  0.0,  0.0,  0.5,  0.5,  0.5,  0.5,  0.0, -0.5 ],
            [ -1.0,  0.5,  0.5,  0.5,  0.5,  0.5,  0.0, -1.0 ],
            [ -1.0,  0.0,  0.5,  0.0,  0.0,  0.0,  0.0, -1.0 ],
            [ -2.0, -1.0, -1.0, -0.5, -0.5, -1.0, -1.0, -2.0 ]
        ];
    static _kingEvalWhite = [
            [ -3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0 ],
            [ -3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0 ],
            [ -3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0 ],
            [ -3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0 ],
            [ -2.0, -3.0, -3.0, -4.0, -4.0, -3.0, -3.0, -2.0 ],
            [ -1.0, -2.0, -2.0, -2.0, -2.0, -2.0, -2.0, -1.0 ],
            [  2.0,  2.0,  0.0,  0.0,  0.0,  0.0,  2.0,  2.0 ],
            [  2.0,  3.0,  1.0,  0.0,  0.0,  1.0,  3.0,  2.0 ]
        ];
    static _kingEvalBlack = ChessBot._rev(ChessBot._kingEvalWhite);
    // In the endgame the king should march to the centre instead of hiding.
    static _kingEndEvalWhite = [
            [ -5.0, -4.0, -3.0, -2.0, -2.0, -3.0, -4.0, -5.0 ],
            [ -3.0, -2.0, -1.0,  0.0,  0.0, -1.0, -2.0, -3.0 ],
            [ -3.0, -1.0,  2.0,  3.0,  3.0,  2.0, -1.0, -3.0 ],
            [ -3.0, -1.0,  3.0,  4.0,  4.0,  3.0, -1.0, -3.0 ],
            [ -3.0, -1.0,  3.0,  4.0,  4.0,  3.0, -1.0, -3.0 ],
            [ -3.0, -1.0,  2.0,  3.0,  3.0,  2.0, -1.0, -3.0 ],
            [ -3.0, -3.0,  0.0,  0.0,  0.0,  0.0, -3.0, -3.0 ],
            [ -5.0, -3.0, -3.0, -3.0, -3.0, -3.0, -3.0, -5.0 ]
        ];
    static _kingEndEvalBlack = ChessBot._rev(ChessBot._kingEndEvalWhite);

    // Board is game.board(): row 0 = rank 8, col 0 = file a, which matches the
    // orientation of the *White* tables above.
    static _pieceSquareValue(t, w, row, col, endgame) {
        if (t == "p")
            return 10 + (w ? ChessBot._pawnEvalWhite : ChessBot._pawnEvalBlack)[row][col];
        if (t == "n")
            return 30 + ChessBot._knightEval[row][col];
        if (t == "b")
            return 30 + (w ? ChessBot._bishopEvalWhite : ChessBot._bishopEvalBlack)[row][col];
        if (t == "r")
            return 50 + (w ? ChessBot._rookEvalWhite : ChessBot._rookEvalBlack)[row][col];
        if (t == "q")
            return 90 + ChessBot._queenEval[row][col];
        if (t == "k")
            return 900 + (endgame
                ? (w ? ChessBot._kingEndEvalWhite : ChessBot._kingEndEvalBlack)[row][col]
                : (w ? ChessBot._kingEvalWhite : ChessBot._kingEvalBlack)[row][col]);
        return 0;
    }
}

const bot = new ChessBot();

return {
    install,
    load,
    reload,
    getData,
    save,
    reset,
    destroy,
    setLevel: function(n) {
        bot.setLevel(n);
        if (data) { data.level = bot.getLevel(); save(); }
    },
    getLevel: function() { return bot.getLevel(); }
};
})(jQuery);
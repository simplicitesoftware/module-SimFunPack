<!--
 ___ _            _ _    _ _    __
/ __(_)_ __  _ __| (_)__(_) |_ /_/
\__ \ | '  \| '_ \ | / _| |  _/ -_)
|___/_|_|_|_| .__/_|_\__|_|\__\___|
            |_| 
-->
![Logo](https://platform.simplicite.io/logos/standard/logo250.png)
* * *

`SimFunPack` module definition
==============================

![Logo](https://platform.simplicite.io/logos/standard/logo250.png)
* * *

SimFunPack
==========

A light-hearted add-on module for [Simplicité](https://www.simplicite.io/) that
hides three fully playable games ("easter eggs") in the platform UI.

| Game           | Where it lives           | How to launch it                                     |
|----------------|--------------------------|------------------------------------------------------|
| Space Invaders | Login (logon) page       | Click the Simplicité logo above the sign-in form     |
| SimpliChess    | Any authenticated screen | Type `gambit` in the global search field             |
| 2048           | Any authenticated screen | Type `2^11` in the global search field (2^11 = 2048) |

Enabling the games
------------------

All three games are gated by the `SIM_EASTER_EGGS` system parameter (type `LFL`),
shipped with this module. Its value is one flag per game:

``` json
{
  "invaders": "devmode",
  "gambit":   "devmode",
  "2048":     "devmode"
}
```

| Value       | Effect                                                |
|-------------|-------------------------------------------------------|
| `"devmode"` | Active only when the front-end runs in developer mode |
| `true`      | Always active, for every user                         |
| `false`     | Disabled                                              |

Edit the parameter (*System parameters* &rarr; `SIM_EASTER_EGGS`) to turn a game
on or off; the change applies on the next UI reload. The JSON keys are
`invaders` / `gambit` / `2048`, while the games are launched with the words in
the table above.

Space Invaders
--------------

On the **login (logon) page**, click the Simplicité **logo** shown above the
sign-in form. A Space Invaders game starts and is played on top of the login
screen (the form is the "death star" to bring down). It runs before
authentication, follows the light/dark theme, and keeps your best score in the
browser (`localStorage`, key `logon_best_score`). Reload the page to leave.

SimpliChess
-----------

Type **`gambit`** in the UI global (quick) search field. The chessboard opens in
a dedicated work-area tab ("Chess") when the splitter is enabled, otherwise in a
side dialog.

* Play against the computer or against another connected user.
* The position is stored per user in the `GAME_CHESS` system parameter, so an
  unfinished game is restored the next time you open it.
* Multiplayer moves are relayed by the **`SimChess`** server script: when a
  player moves, their `GAME_CHESS` value is copied to the opponent's user
  parameter and a Server-Sent Event refreshes the opponent's board in real time.
* The board widget, rules engine and piece images ship in the `SIM_CHESSBOARD`
  resource set, loaded on first use.

### Move computation

The bot asks the server for a move via the **`SimGameChess`** REST external
object (`?fen=<FEN>&depth=<n>&format=san`), which returns
`{ "move", "depth", "time", "pos" }`. `SimGameChess` delegates to the Java
chess engine in `simfunpack-chess.jar` (`FullSearch.bestMove(...)`). If the
service is unavailable the disposition falls back to a local JavaScript engine
with selectable strength (Beginner .. Expert).

2048
----

Type **`2^11`** (that is, 2048) in the UI global search field. The grid opens in
a work-area tab ("2048") or a side dialog. Move the tiles with the arrow keys or
by swiping. The game state is saved per user in the `GAME_2048` system parameter
and restored on reopen; reaching 2048 lets you keep going for the next power of
two.

Module contents
---------------

| Type                 | Code               | Purpose                                             |
|----------------------|--------------------|-----------------------------------------------------|
| System parameter     | `SIM_EASTER_EGGS`  | Enables / disables each game                        |
| Server script        | `SimChess`         | Relays chess moves to the opponent over SSE         |
| REST external object | `SimGameChess`     | `/bestmove` service: best move for a FEN position   |
| Library (LIB script) | `simfunpack-chess` | `lib/simfunpack-chess.jar`, the Java chess engine   |
| Disposition resource | `SIM_INVADERS`     | Space Invaders game (JS)                            |
| Disposition resource | `SIM_CHESS_GAME`   | SimpliChess game + local engine (JS)                |
| Disposition resource | `SIM_CHESS_STYLES` | SimpliChess styles (LESS/CSS)                       |
| Disposition resource | `SIM_CHESSBOARD`   | Chessboard UI, rules engine, piece images (ZIP set) |
| Disposition resource | `SIM_2048_GAME`    | 2048 game (JS)                                      |
| Disposition resource | `SIM_2048_STYLES`  | 2048 styles (LESS/CSS)                              |

UI resources are attached to the `responsive5` disposition.

Module build
------------

See [BUILD.md](BUILD.md):

``` text
mvn clean package
```

Building the chess engine
-------------------------

The Java engine under `others/` is a **standalone Maven project**, independent
of the module's generated `pom.xml`:

``` text
mvn -f others/pom.xml clean package
```

This produces `others/target/simfunpack-chess.jar`.
It must be delivered manually in the module shared script `simfunpack-chess`.

Front-end tooling
-----------------

The JavaScript / TypeScript checks (ESLint, JSHint, StyleLint, `tsc`) need the
dev dependencies installed once:

``` text
npm install
npm run tsc      # type-check resources/**/*.ts against dist/simplicite.d.ts
npm run eslint   # resources/**/*.js
```

`node_modules/` is not tracked, so after a fresh clone (or if the working copy
was re-created) these are missing. A `Cannot find type definition file for
'jquery'` error in `tsconfig.json` just means `npm install` has not been run yet;
in an editor, restart the TS server afterwards.

System parameters
-----------------

| Code | Value | Type | Description |
|---|---|---|---|
| `SIM_EASTER_EGGS` | `{  "invaders": "devmode",  "gambit": "devmode",  "2048": "devmode" }` | LFL | Use `true` or `"devmode"` to activate the easter egg. |

Shared code
-----------

* `SimChess` _(Server script)_
* `simfunpack-chess` _(Java library)_


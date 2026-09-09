package org.simplicite.chess.servlet;

import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.simplicite.chess.eval.CompleteEvaluator;
import org.simplicite.chess.opening.OpeningBook;
import org.simplicite.chess.search.FullSearch;
import org.simplicite.chess.search.FullSearch.BestMove;
import org.simplicite.chess.util.BBUtils;
import org.simplicite.chess.util.Board;

/**
 * Servlet implementation class ChessService
 */
@WebServlet(name = "bestmove", urlPatterns = { "/api/bestmove" })
public class BestMoveServlet extends HttpServlet
{
	private static final long serialVersionUID = 1L;

	public BestMoveServlet()
	{
		super();
		OpeningBook.init();
	}
    
	/**
	 * Computes the best move for a position and returns it as a JSON string
	 * <code>{"move":..,"depth":..,"time":..,"pos":..}</code>, or <code>{}</code> when no FEN is given.
	 *
	 * @param fen    position in FEN notation (may be null)
	 * @param depth  search depth as a string (may be null, defaults to 5, non-numeric values are ignored)
	 * @param format <code>san</code> for short algebraic notation (Qxe2), anything else for long notation (Qe1xe2)
	 * @return JSON response string
	 */
	public static String bestMove(String fen, String depth, String format)
	{
		if (fen == null)
			return "{}";

		int d = 5;
		if (depth != null)
			try { d = Integer.parseInt(depth); } catch (Exception e) {}

		Board b = new Board(fen);
		FullSearch bot = new FullSearch(new CompleteEvaluator(), d);
		BestMove bm = bot.getBestMove(b);

		//System.out.println("bestmove "+bm.san + " pos="+bm.pos + " time="+(bm.time/1000)+"s");

		return "{\"move\":\"" + ("san".equals(format)
				? bm.san // Qxe2
				: BBUtils.moveToString(bm.move)) // Qe1xe2
			+ "\",\"depth\":" + d + ",\"time\":" + bm.time + ",\"pos\":" + bm.pos
			+ "}";
	}

	/**
	 * https://francois.dev.simplicite.io/simplichess/api/bestmove?depth=5&format=san&&fen=rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R%20b%20KQkq%20-%201%202
	 */
	protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException
	{
		response.getWriter().print(bestMove(
			request.getParameter("fen"),
			request.getParameter("depth"),
			request.getParameter("format")));
	}

	protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException
	{
		doGet(request, response);
	}
}

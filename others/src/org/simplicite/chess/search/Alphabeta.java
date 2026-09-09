package org.simplicite.chess.search;

import org.simplicite.chess.eval.Evaluator;
import org.simplicite.chess.move.MoveGenerator;
import org.simplicite.chess.util.Board;

public class Alphabeta
{
	private static Evaluator evaluator;
	private static final int DEPTH = 4;
	private static int evals;

	public static void setEvaluator(Evaluator eval)
	{
		evaluator = eval;
	}
	
	public static int getBestMove(Board b)
	{
		evals = 0;
		
		int[] moves = new int[Board.MAX_MOVES];
		int num_moves = MoveGenerator.getAllLegalMoves(b, moves);
		
		int max = Integer.MIN_VALUE;
		int bestmove = 0;
		
		for (int i = 0; i < num_moves; i++) {
			b.makeMove(moves[i]);
			int value = -alphabeta(b, Integer.MIN_VALUE + 1, Integer.MAX_VALUE - 1, DEPTH);
			b.undoMove();
			if (value > max) {
				max = value;
				bestmove = moves[i];
			}
		}
		
		System.out.println(evals + " nodes evalated.");
		return bestmove;
	}
	
	public static int alphabeta(Board b, int alpha, int beta, int depth)
	{
		if (depth == 0 || b.isEndOfGame()) {
			evals++;
			return evaluator.eval(b);
		}
		
		int[] moves = new int[Board.MAX_MOVES];
		int num_moves = MoveGenerator.getAllLegalMoves(b, moves);
		
		for (int i = 0; i < num_moves; i++)
		{
			b.makeMove(moves[i]);
			int value = -alphabeta(b, -beta, -alpha, depth - 1);
			b.undoMove();
			if (value >= beta)
				return beta;
			if (value > alpha)
				alpha = value;
		}
		
		return alpha;
	}
}

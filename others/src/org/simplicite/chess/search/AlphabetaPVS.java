package org.simplicite.chess.search;

import org.simplicite.chess.eval.Evaluator;
import org.simplicite.chess.move.MoveGenerator;
import org.simplicite.chess.util.BBUtils;
import org.simplicite.chess.util.Board;

public class AlphabetaPVS
{
	private static final int DEPTH = 4;
	
	private static Evaluator evaluator;
	
	public static int[][] triangularArray;
	public static int[] triangularLength;
	
	private static int evals;
	private static int pv_attempts;
	private static int pv_fails;
	
	static {
		triangularArray = new int[Board.MAX_MOVES][Board.MAX_MOVES];
		triangularLength = new int[Board.MAX_MOVES];
	}
	
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
		
		for (int i = 0; i < num_moves; i++)
		{
			b.makeMove(moves[i]);
			int value = -alphabetaPVS(b, Integer.MIN_VALUE + 1, Integer.MAX_VALUE - 1, DEPTH, 0);
			b.undoMove();
			
			if (value > max)
			{
				max = value;
				bestmove = moves[i];
			}
		}
		return bestmove;
	}
	
	public static int alphabetaPVS(Board b, int alpha, int beta, int depth, int ply)
	{
		triangularLength[ply] = ply;
		int movesfound = 0;
		int val = 0;
		
		if (depth == 0) {
			evals++;
			return evaluator.eval(b);
		}
		
		int[] moves = new int[Board.MAX_MOVES];
		int num_moves = MoveGenerator.getAllLegalMoves(b, moves);
		
		for (int i = 0; i < num_moves; i++)
		{
			b.makeMove(moves[i]);
			if (movesfound != 0)
			{
				pv_attempts++;
				val = -alphabetaPVS(b, -alpha - 1, -alpha, depth - 1, ply + 1);
				
				if (val > alpha && val < beta)
				{
					pv_fails++;
					val = -alphabetaPVS(b, -beta, -alpha, depth - 1, ply + 1);
				}
			}
			else
			{
				val = -alphabetaPVS(b, -beta, -alpha, depth - 1, ply + 1);
			}
			b.undoMove();
			
			if (val >= beta)
				return beta;
			if (val > alpha)
			{
				alpha = val;
				movesfound++;
				
				triangularArray[ply][ply] = moves[i];
				
				for (int j = ply + 1; j < triangularLength[ply + 1]; j++)
					triangularArray[ply][j] = triangularArray[ply + 1][j];

				triangularLength[ply] = triangularLength[ply + 1];
			}
		}
		
		return alpha;
	}
}

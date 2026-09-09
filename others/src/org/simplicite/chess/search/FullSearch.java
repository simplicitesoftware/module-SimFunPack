package org.simplicite.chess.search;

import java.util.Date;

import org.simplicite.chess.eval.Evaluator;
import org.simplicite.chess.move.MoveGenerator;
import org.simplicite.chess.opening.OpeningBook;
import org.simplicite.chess.util.BBUtils;
import org.simplicite.chess.util.Board;
import org.simplicite.chess.util.Move;
import org.simplicite.chess.util.SANUtils;

/**
 * Searching based on null-move pruning, iterative deepening, quiescent
 * searching, static exchange evaluation, alpha-beta, PVS, and history
 * heuristics.
 */
public class FullSearch
{
	private static final int NULLMOVE_REDUCTION = 4;
	private static final int NULLMOVE_THRESHOLD = 319;
	
	private Board board;
	private Evaluator evaluator;
	private int max_search_depth = 5;
	private int[][] white_heuristics;
	private int[][] black_heuristics;
	private int[][] triangularArray;
	private int[] triangularLength;
	private boolean follow_pv;
	private boolean allow_null;
	private int[] lastPV;
	private int count;

	public FullSearch(Evaluator eval, int depth)
	{
		setEvaluator(eval);
		setDepth(depth);
	}
	
	public void setDepth(int depth)
	{
		if (depth<2) depth = 2;
		else if (depth>10) depth = 10;
		max_search_depth = depth;
	}
	
	public void setEvaluator(Evaluator eval)
	{
		evaluator = eval;
	}
	
	/**
	 * Outputs the entire contents of the PV array, including "blank space".
	 */
	public void printPV()
	{
		for (int i=0; i<lastPV.length-1; i++)
			System.out.print(BBUtils.moveToString(lastPV[i]) + " ");
		System.out.println();
	}
	
	public static class BestMove 
	{
		public int move;
		public long time;
		public int pos;
		public String san;
	}
	
	/**
	 * Returns the best move in a position, at least according to the engine.
	 * @param b the position to consider
	 * @return the best move the engine can find.
	 */
	public BestMove getBestMove(Board b)
	{
		board = b;
		BestMove bm = new BestMove();
		bm.time = new Date().getTime();
		bm.pos = 0;
		
		int bookmove = OpeningBook.getBookMove(b);
		if (bookmove!=OpeningBook.MOVE_NOT_FOUND)
		{
			bm.move = bookmove;
			bm.time = new Date().getTime() - bm.time;
			bm.san = SANUtils.getSAN(b, bookmove);
			return bm;
		}
		
		white_heuristics = new int[64][64];
		black_heuristics = new int[64][64];
		lastPV = new int[Board.MAX_MOVES];
		count = 0;
		
		for (int curr_depth=1; curr_depth<max_search_depth; curr_depth++)
		{
			triangularArray = new int[Board.MAX_MOVES][Board.MAX_MOVES];
			triangularLength = new int[Board.MAX_MOVES];
			follow_pv = true;
			allow_null = true;
			alphabeta(Integer.MIN_VALUE + 1, Integer.MAX_VALUE - 1, curr_depth, 0);
		}

		bm.move = lastPV[0];
		bm.time = new Date().getTime() - bm.time;
		bm.san = SANUtils.getSAN(b, bm.move);
		bm.pos = count;
		return bm;
	}
	
	private int alphabeta(int alpha, int beta, int depth, int ply)
	{
		count++;
		triangularLength[ply] = ply;
		if (depth<=0) {
			follow_pv = false;
			return qsearch(alpha, beta, ply);
		}
		
		if (board.isEndOfGame())
		{
			follow_pv = false;
			return evaluator.eval(board);
		}
		
		// attempt null move
		if (allow_null && !follow_pv && board.movingSideMaterial() > NULLMOVE_THRESHOLD && !board.isCheck())
		{
			allow_null = false;
			board.doNullMove();
			int val = -alphabeta(-beta, -beta + 1, depth - NULLMOVE_REDUCTION, ply);
			board.undoMove();
			allow_null = true;
			if (val>=beta)
				return val;
		}
		
		allow_null = true;		
		int movesfound = 0;
		int val = 0;
		int[] moves = new int[Board.MAX_MOVES];
		int num_moves = MoveGenerator.getAllLegalMoves(board, moves);
		
		for (int i=0; i<num_moves; i++) 
		{
			putBestMoveFirst(ply, depth, i, moves, num_moves, board.white_to_move);
			board.makeMove(moves[i]);
			
			if (movesfound != 0)
			{
				val = -alphabeta(-alpha - 1, -alpha, depth - 1, ply + 1);
				
				if (val > alpha && val < beta)
					val = -alphabeta(-beta, -alpha, depth - 1, ply + 1);
			}
			else
				val = -alphabeta(-beta, -alpha, depth - 1, ply + 1);
			
			board.undoMove();
			
			if (val>=beta) 
			{
				if (board.white_to_move)
					white_heuristics[Move.getFrom(moves[i])][Move.getTo(moves[i])] += depth * depth;
				else
					black_heuristics[Move.getFrom(moves[i])][Move.getTo(moves[i])] += depth * depth;				
				return beta;
			}
			if (val>alpha) {
				alpha = val;
				movesfound++;
				
				triangularArray[ply][ply] = moves[i];
				for (int j=ply+1; j<triangularLength[ply+1]; j++)
					triangularArray[ply][j] = triangularArray[ply + 1][j];				
				triangularLength[ply] = triangularLength[ply + 1];
				
				if (ply==0)
					rememberPV();
			}
		}
		
		if (movesfound != 0)
		{
			if (board.white_to_move)
				white_heuristics[Move.getFrom(triangularArray[ply][ply])][Move.getTo(triangularArray[ply][ply])] += depth * depth;
			else
				black_heuristics[Move.getFrom(triangularArray[ply][ply])][Move.getTo(triangularArray[ply][ply])] += depth * depth;
		}
		
		return alpha;
	}
	
	private void putBestMoveFirst(int ply, int depth, int next_index, int[] moves, int num_moves, boolean white_to_move) 
	{
		// if applicable, make next move the PV
		if (follow_pv && depth>1)
		{
			for (int i=next_index; i<num_moves; i++)
			{
				if (moves[i] == lastPV[ply])
				{
					int temp = moves[i];
					moves[i] = moves[next_index];
					moves[next_index] = temp;
					return;
				}
			}
		}
		
		// get best heuristic
		if (white_to_move)
		{
			int best = white_heuristics[Move.getFrom(moves[next_index])][Move.getTo(moves[next_index])];
			int best_loc = next_index;
			
			for (int i=next_index+1; i<num_moves; i++)
			{
				if (white_heuristics[Move.getFrom(moves[i])][Move.getTo(moves[i])] > best)
				{
					best = white_heuristics[Move.getFrom(moves[i])][Move.getTo(moves[i])];
					best_loc = i;
				}
			}
			
			if (best_loc>next_index)
			{
				int temp = moves[best_loc];
				moves[best_loc] = moves[next_index];
				moves[next_index] = temp;
			}
		}
		else
		{
			int best = black_heuristics[Move.getFrom(moves[next_index])][Move.getTo(moves[next_index])];
			int best_loc = next_index;
			
			for (int i=next_index+1; i<num_moves; i++)
			{
				if (black_heuristics[Move.getFrom(moves[i])][Move.getTo(moves[i])] > best)
				{
					best = black_heuristics[Move.getFrom(moves[i])][Move.getTo(moves[i])];
					best_loc = i;
				}
			}
			
			if (best_loc>next_index)
			{
				int temp = moves[best_loc];
				moves[best_loc] = moves[next_index];
				moves[next_index] = temp;
			}
		}
	}
	
	private void rememberPV() {
		for (int i=0; i<triangularLength[0]; i++)
			lastPV[i] = triangularArray[0][i];
	}
	
	private int qsearch(int alpha, int beta, int ply)
	{
		triangularLength[ply] = ply;
		
		if (board.isCheck())
			return alphabeta(alpha, beta, 1, ply);
		
		int stand_pat = evaluator.eval(board);
		
		if (stand_pat>=beta)
			return stand_pat;
		if (stand_pat>alpha)
			alpha = stand_pat;
		
		int[] captures = new int[Board.MAX_MOVES];
		int num_captures = generateCaptures(board, captures);
		
		for (int i=0; i<num_captures; i++)
		{
			board.makeMove(captures[i]);
			int val = -qsearch(-beta, -alpha, ply + 1);
			board.undoMove();
			
			if (val>=beta)
				return val;
			if (val>alpha) {
				alpha = val;
				triangularArray[ply][ply] = captures[i];
				for (int j=ply+1; j<triangularLength[ply+1]; j++)
					triangularArray[ply][j] = triangularArray[ply + 1][j];
				triangularLength[ply] = triangularLength[ply + 1];
			}
		}
		
		return alpha;
	}
	
	public static int generateCaptures(Board b, int[] captures)
	{
		int[] capturevals = new int[Board.MAX_MOVES];
		int num_captures = MoveGenerator.getAllCapturesAndPromotions(b, captures);
		
		for (int i = 0; i < num_captures; i++) {
			int val = b.see(captures[i]);
			capturevals[i] = val;
			
			if (val < 0) { // not worth it
				BBUtils.remove(captures,i);
				BBUtils.remove(capturevals,i);
				num_captures--;
				i--;
			}
			
			int insertloc = i;
			
			while (insertloc >= 0 && capturevals[i] > capturevals[insertloc]) {
				int tempcap = captures[i];
				captures[i] = captures[insertloc];
				captures[insertloc] = tempcap;
				
				int tempval = capturevals[i];
				capturevals[i] = capturevals[insertloc];
				capturevals[insertloc] = tempval;
				
				insertloc--;
			}
		}
		
		return num_captures;
	}
}

package org.simplicite.chess.move;

import org.simplicite.chess.util.Board;
import org.simplicite.chess.util.Move;

public class MoveGenerator
{
	public static int getAllMoves(Board b, int[] moves)
	{
		return b.white_to_move ? getAllWhiteMoves(b, moves) : getAllBlackMoves(b, moves);
	}
	
	private static int getAllWhiteMoves(Board b, int[] moves)
	{
		int index = 0;	
		index += MoveGetter.getWhitePawnMoves(b, moves, index);
		index += MoveGetter.getWhiteKnightMoves(b, moves, index);
		index += MoveGetter.getWhiteKingMoves(b, moves, index);
		index += MoveGetter.getWhiteRookMoves(b, moves, index);
		index += MoveGetter.getWhiteBishopMoves(b, moves, index);
		index += MoveGetter.getWhiteQueenMoves(b, moves, index);
		return index;
	}
	
	private static int getAllBlackMoves(Board b, int[] moves)
	{
		int index = 0;	
		index += MoveGetter.getBlackPawnMoves(b, moves, index);
		index += MoveGetter.getBlackKnightMoves(b, moves, index);
		index += MoveGetter.getBlackKingMoves(b, moves, index);
		index += MoveGetter.getBlackRookMoves(b, moves, index);
		index += MoveGetter.getBlackBishopMoves(b, moves, index);
		index += MoveGetter.getBlackQueenMoves(b, moves, index);
		return index;
	}
	
	public static int getAllLegalMoves(Board b, int[] moves)
	{
		int lastIndex = getAllMoves(b, moves);
		int j = 0;
		for (int i=0; i<lastIndex; i++)
		{
			if (b.makeMove(moves[i]))
			{
				moves[j++] = moves[i];
				b.undoMove();
			}
		}
		return j;
	}
	
	public static int getAllCapturesAndPromotions(Board b, int[] moves)
	{
		int lastIndex = getAllLegalMoves(b, moves);
		int j = 0;
		for (int i=0; i<lastIndex; i++)
		{
			if (Move.isPromotion(Move.getFlag(moves[i])) || Move.isCapture(moves[i]))
				moves[j++] = moves[i];
		}
		return j;
	}
}

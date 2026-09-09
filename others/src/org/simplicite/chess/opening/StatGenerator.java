package org.simplicite.chess.opening;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.DataInputStream;
import java.io.FileInputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;

import org.simplicite.chess.util.BBUtils;
import org.simplicite.chess.util.Board;
import org.simplicite.chess.util.SANUtils;

public class StatGenerator
{
	private static final String OPENING_BOOK = "src/org/simplicite/chess/opening/book.txt";
	private static final String GAME_LINES = "opening/opening.txt";
	private static final int DEPTH = 14;
	private static final int MAX_GAMES = 1500000;
	
	public static void generate()
	{
		try {
			BufferedReader br = new BufferedReader(new InputStreamReader(new DataInputStream(new FileInputStream(GAME_LINES))));
			int count = 0;
			String line;
			
			// Board key => move => count
			HashMap<Long, Map<Integer, Integer>> map = new HashMap<>();

			while ((line=br.readLine())!=null && count<MAX_GAMES)
			{
				count++;
				if (count%500 == 0)
					System.out.println("Evaluated " + count + "/" + MAX_GAMES + " positions...");
				
				String[] moves = line.split(" ");
				if (moves.length<=DEPTH)
					continue;

				Board b = new Board(BBUtils.START_FEN);
				for (int i=0; i<DEPTH; i++)
				{
					int move = SANUtils.getMove(b, moves[i]);
					Map<Integer, Integer> m = map.get(b.key);
					if (m==null)
					{
						m = new HashMap<>();
						map.put(b.key, m);
					}
					Integer n = m.get(move);
					m.put(move, n==null ? 1 : n+1);
					b.makeMove(move);
				}
			}
			br.close();
			
			for (Entry<Long, Map<Integer,Integer>> e : map.entrySet())
			{
				// total
				double total = 0;
				Map<Integer,Integer> m = e.getValue();
				for (Entry<Integer,Integer> move : m.entrySet())
					total += move.getValue();
				// move in %
				for (Entry<Integer,Integer> move : m.entrySet())
					move.setValue((int)Math.round(move.getValue()*100/total));
			}

			StringBuilder output = new StringBuilder();
			for (Entry<Long, Map<Integer,Integer>> e : map.entrySet())
			{
				Long key = e.getKey();
				output.append(key); // board key
				Map<Integer,Integer> m = e.getValue();
				for (Entry<Integer,Integer> move : m.entrySet())
					output.append(" " + move.getKey() + " " + move.getValue()); // move proba
				output.append("\n");
			}
			writeFile(OPENING_BOOK, output.toString());
		}
		catch (Exception e) {
			e.printStackTrace();
		}
		System.out.println("Done.");
	}
	
	private static void writeFile(String path, String content)
	{
		try {
			FileWriter fw = new FileWriter(path, true);
			BufferedWriter bw = new BufferedWriter(fw);
			bw.write(content);
			bw.close();
		}
		catch (IOException e) {
			e.printStackTrace();
		}
	}
	
	public static void main(String[] args)
	{
		generate();
	}
}

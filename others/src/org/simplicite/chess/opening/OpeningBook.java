package org.simplicite.chess.opening;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeMap;

import org.simplicite.chess.util.Board;

public class OpeningBook
{
	private static TreeMap<Long, List<Proba>> book = null;
	public static final int MOVE_NOT_FOUND = -1;
	
	public static void init()
	{
		try
		{
			InputStream is = OpeningBook.class.getResourceAsStream("/org/simplicite/chess/opening/book.txt");
			BufferedReader br = new BufferedReader(new InputStreamReader(is));		
			book = new TreeMap<Long, List<Proba>>();
			
			// board => [ {move, proba} ]
			String line;
			while ((line=br.readLine()) != null)
			{
				String l[] = line.split(" ");
				long key = Long.parseLong(l[0]);
				List<Proba> list = book.get(key);
				if (list==null) {
					list = new ArrayList<>();
					book.put(key, list);
				}
				book.put(key, list);

				int i = 1, p = 0;
				while (i<l.length)
				{
					Proba proba = new Proba();
					proba.move = Integer.parseInt(l[i]);
					proba.min = p;
					p += Integer.parseInt(l[i+1]);
					proba.max = p;					
					list.add(proba);
					i += 2;
				}
			}
			is.close();
			br.close();
		}
		catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	private static class Proba
	{
		private int move, min, max;
	}

	public static int getBookMove(Board b)
	{
		if (book==null) init();
		List<Proba> list = book.get(b.key);
		if (list==null || list.size()==00)
			return MOVE_NOT_FOUND;
		int rnd = (int)Math.floor(Math.random()*100);
		for (Proba p : list)
		{
			if (p.min<=rnd && rnd<p.max)
				return p.move;			
		}
		return MOVE_NOT_FOUND;
	}
}

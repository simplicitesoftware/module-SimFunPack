package org.simplicite.chess.opening;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.DataInputStream;
import java.io.FileInputStream;
import java.io.FileWriter;
import java.io.InputStreamReader;

public class OpeningInitializer
{
	private static final String OPENING_DB = "opening/millionbase-2574k.pgn";
	private static final String OUTPUT = "opening/opening.txt";
	
	public static void init()
	{
		int count = 0;
		try {
			FileWriter fw = new FileWriter(OUTPUT, true);
			BufferedWriter bw = new BufferedWriter(fw);
			FileInputStream fis = new FileInputStream(OPENING_DB);
			BufferedReader br = new BufferedReader(new InputStreamReader(new DataInputStream(fis)));

			String line;
			String game = "";
			while ((line=br.readLine()) != null)
			{
				line = line.trim();
				if (line.isEmpty() || line.startsWith("["))
					continue;
				// New game
				if (line.startsWith("1.")) {
					if (game.length()>0)
					{
						count++;
						game = game.replaceAll("\\{.+?\\} ", "");
						game = game.replaceAll("\\d+\\.", "");
						game = game.replaceAll("\\s\\s+", " ");
						System.out.println(count+": "+game);
						bw.write(game.trim() + "\n");
					}
					game = line;
				}
				else // append to current game
					game += " " + line;
			}
			
			// last game
			if (game.length()>0)
			{
				count++;
				game = game.replaceAll("\\{.+?\\} ", "");
				game = game.replaceAll("\\d+\\.", "");
				game = game.replaceAll("\\s\\s+", " ");
				System.out.println(count+": "+game);
				bw.write(game.trim() + "\n");
			}
			
			bw.close();
			br.close();
			fis.close();
			fw.close();
		}
		catch (Exception e) {
			e.printStackTrace();
		}
		System.out.println("Done");
	}

	public static void main(String[] args) {
		init();
	}
}
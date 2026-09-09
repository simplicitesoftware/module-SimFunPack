package org.simplicite.chess.servlet;

import java.io.IOException;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.simplicite.chess.opening.OpeningBook;
import org.simplicite.chess.search.FullSearch;

/**
 * Servlet implementation class
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
    
	protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException
	{
		response.getWriter().print(FullSearch.bestMove(
			request.getParameter("fen"),
			request.getParameter("depth"),
			request.getParameter("format")));
	}

	protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException
	{
		doGet(request, response);
	}
}

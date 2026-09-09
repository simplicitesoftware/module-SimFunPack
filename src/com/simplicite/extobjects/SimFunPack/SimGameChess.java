package com.simplicite.extobjects.SimFunPack;

import java.lang.reflect.InvocationTargetException;

import org.json.JSONObject;

import com.simplicite.util.exceptions.*;
import com.simplicite.util.tools.*;

/**
 * REST wrapper for bestMove service
 */
public class SimGameChess extends com.simplicite.webapp.services.RESTServiceExternalObject {
    private static final long serialVersionUID = 1L;

    /** Chess engine classes (from others/src), invoked by reflection to avoid a hard build/link dependency. */
    private static final String ENGINE_CLASS = "org.simplicite.chess.search.FullSearch";
    private static final String BOOK_CLASS = "org.simplicite.chess.opening.OpeningBook";

    @Override
    public void init(Parameters params) {
        // Eager opening-book warm-up; the engine also lazy-loads it on first use, so a failure here is not fatal.
        try {
            Class.forName(BOOK_CLASS).getMethod("init").invoke(null);
        }
        catch (ReflectiveOperationException e) {
            // chess engine not on the classpath - ignored here, get() reports it
        }
    }

    /**
     * GET method handler: computes the best move for a position.
     * Delegates by reflection to <code>org.simplicite.chess.servlet.BestMoveServlet.bestMove(String, String, String)</code>.
     * Query parameters:
     * <ul>
     *   <li><code>fen</code>: position in FEN notation (required, otherwise an empty object is returned)</li>
     *   <li><code>depth</code>: search depth (optional, defaults to 5)</li>
     *   <li><code>format</code>: <code>san</code> for short algebraic notation, anything else for long notation</li>
     * </ul>
     * @param params Request parameters
     * @return JSON object <code>{ move, depth, time, pos }</code>
     * @throws HTTPException
     */
    @Override
    public Object get(Parameters params) throws HTTPException {
        String fen = params.getParameter("fen");
        if (fen != null && fen.isEmpty())
            fen = null;
        try {
            Object json = Class.forName(ENGINE_CLASS)
                .getMethod("bestMove", String.class, String.class, String.class)
                .invoke(null, fen, params.getParameter("depth"), params.getParameter("format"));
            return new JSONObject((String) json);
        }
        catch (InvocationTargetException e) {
            return error(e.getCause() != null ? e.getCause() : e);
        }
        catch (ReflectiveOperationException e) {
            return internalServerError("Chess engine not available: " + e);
        }
    }

    /*
     * POST = GET
     */
    @Override
    public Object post(Parameters params) throws HTTPException {
        return get(params);
    }
}

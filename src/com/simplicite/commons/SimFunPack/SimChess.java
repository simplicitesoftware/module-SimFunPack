package com.simplicite.commons.SimFunPack;

import org.json.JSONObject;

import com.simplicite.util.AppLog;
import com.simplicite.util.ObjectDB;
import com.simplicite.util.Grant;
import com.simplicite.util.Tool;

/**
 * Shared code SimChess
 */
public class SimChess implements java.io.Serializable {
    private static final long serialVersionUID = 1L;

    public void notify(ObjectDB obj, String code, String value) {
        Grant g = obj.getGrant();
        String login = g.getLogin();
        JSONObject o = new JSONObject(value);
        String whiteLogin = o.getJSONObject("white").optString("login");
        String blackLogin = o.getJSONObject("black").optString("login");

        String opponent = null;
        if (!Tool.isEmpty(whiteLogin) && !login.equals(whiteLogin))
            opponent = whiteLogin;
        else if (!Tool.isEmpty(blackLogin) && !login.equals(blackLogin))
            opponent = blackLogin;
        if (opponent == null) 
            return;

        g.setUserSystemParam(opponent, code, value, false);

        // Live-notify the opponent over SSE. Called by reflection to avoid a compile
        // dependency on com.simplicite.webapp.sse (not exported yet by simplicite-api).
        try {
            Class<?> sse = Class.forName("com.simplicite.webapp.sse.ServerSideEvent");
            String eventUpdate = (String)sse.getField("EVENT_UPDATE").get(null);
            sse.getMethod("pushObject", String.class, ObjectDB.class, String.class, String.class, String.class)
                .invoke(null, eventUpdate, obj, null, obj.getRowId(), opponent);
        } catch (ReflectiveOperationException e) {
            AppLog.warning(SimChess.class, "notify", "SSE ServerSideEvent.pushObject unavailable", e, g);
        }
    }
}

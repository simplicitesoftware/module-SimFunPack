package com.simplicite.commons.SimFunPack;

import java.util.*;
import org.json.JSONObject;

import com.simplicite.util.ObjectDB;
import com.simplicite.util.Grant;
import com.simplicite.util.Tool;
import com.simplicite.webapp.sse.ServerSideEvent;

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
        ServerSideEvent.pushObject(ServerSideEvent.EVENT_UPDATE, obj, null, obj.getRowId(), opponent);
    }
}

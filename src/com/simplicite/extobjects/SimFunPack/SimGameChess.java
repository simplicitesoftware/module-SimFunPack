package com.simplicite.extobjects.SimFunPack;

import java.util.*;

import org.json.*;

import com.simplicite.util.*;
import com.simplicite.util.exceptions.*;
import com.simplicite.util.tools.*;

/**
 * REST service external object SimGameChess
 */
public class SimGameChess extends com.simplicite.webapp.services.RESTServiceExternalObject {
    private static final long serialVersionUID = 1L;

    /*@Override
    public void init(Parameters params) {
        // if needed...
    }*/

    /**
     * GET method handler (returns bad request by default)
     * @param params Request parameters
     * @return Typically JSON object or array
     * @throws HTTPException
     */
    @Override
    public Object get(Parameters params) throws HTTPException {
        /* Example:
        return new JSONObject().put("response", "Hello world!");
        */
        return super.get(params);
    }

    /**
     * POST method handler (returns bad request by default)
     * @param params Request parameters
     * @return Typically JSON object or array
     * @throws HTTPException
     */
    @Override
    public Object post(Parameters params) throws HTTPException {
        /* Example:
        try {
            JSONObject req = params.getJSONObject();
            if (req!=null) {
                return new JSONObject()
                    .put("request", req)
                    .put("response", "Hello " + req.optString("name", "Unknown") + "!");
            }
            return badRequest("Call me with a request please!");
        } catch (Exception e) {
            return error(e);
        }
        */
        return super.post(params);
    }
}

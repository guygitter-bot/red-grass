package app.kidzfinder;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

// הגשר בין מסכי הילד (webview) לקוד האנדרואיד: חיבור בקוד, מצב, SOS, והפסקת שיתוף.
@CapacitorPlugin(name = "Kid")
public class KidPlugin extends Plugin {

    public static final String API_BASE = "https://kidzfinder-api.guygitter.workers.dev";
    public static final String PREFS = "kf";

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // מצב נוכחי: האם מחובר, שמות, ומתי נשלח מיקום לאחרונה
    @PluginMethod
    public void getStatus(PluginCall call) {
        SharedPreferences p = prefs(getContext());
        JSObject res = new JSObject();
        boolean paired = p.getString("childToken", null) != null;
        res.put("paired", paired);
        res.put("childName", p.getString("childName", ""));
        res.put("familyName", p.getString("familyName", ""));
        res.put("lastSent", p.getLong("lastSent", 0));
        res.put("hasLocation", hasLocationPermission());
        call.resolve(res);
    }

    // חיבור עם קוד 6 ספרות: פונה לשרת, שומר את הזהות, ומתחיל לשתף מיקום
    @PluginMethod
    public void pair(final PluginCall call) {
        final String code = call.getString("code", "");
        final String childName = call.getString("childName", "ילד/ה");
        new Thread(() -> {
            try {
                JSONObject body = new JSONObject();
                body.put("code", code);
                body.put("childName", childName);
                JSONObject r = postJson(API_BASE + "/api/pair", body, null);
                if (r == null || r.has("error")) {
                    call.reject("bad_code");
                    return;
                }
                SharedPreferences.Editor e = prefs(getContext()).edit();
                e.putString("familyId", r.optString("familyId"));
                e.putString("childId", r.optString("childId"));
                e.putString("childToken", r.optString("childToken"));
                e.putString("childName", childName);
                e.putString("familyName", r.optString("familyName", "המשפחה"));
                e.apply();
                getActivity().runOnUiThread(() -> {
                    requestPermissionsIfNeeded();
                    LocationService.start(getContext());
                    JSObject out = new JSObject();
                    out.put("ok", true);
                    out.put("familyName", r.optString("familyName", "המשפחה"));
                    call.resolve(out);
                });
            } catch (Exception ex) {
                call.reject("network");
            }
        }).start();
    }

    // הילד לוחץ SOS
    @PluginMethod
    public void sos(final PluginCall call) {
        final SharedPreferences p = prefs(getContext());
        new Thread(() -> {
            try {
                postJson(API_BASE + "/api/family/" + p.getString("familyId", "") + "/sos",
                        new JSONObject(), p.getString("childToken", ""));
                call.resolve();
            } catch (Exception ex) {
                call.reject("network");
            }
        }).start();
    }

    // הפסקת שיתוף: עוצר את השירות ומוחק את הזהות מהמכשיר
    @PluginMethod
    public void stopSharing(PluginCall call) {
        LocationService.stop(getContext());
        prefs(getContext()).edit().clear().apply();
        call.resolve();
    }

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    // מבקש הרשאות מיקום והתראות (מיקום-ברקע מתבקש בנפרד על ידי המשתמש בהגדרות)
    private void requestPermissionsIfNeeded() {
        java.util.ArrayList<String> ask = new java.util.ArrayList<>();
        if (!hasLocationPermission()) {
            ask.add(Manifest.permission.ACCESS_FINE_LOCATION);
            ask.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (Build.VERSION.SDK_INT >= 33 &&
                ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            ask.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!ask.isEmpty()) {
            ActivityCompat.requestPermissions(getActivity(), ask.toArray(new String[0]), 7001);
        }
    }

    // שליחת JSON ל-URL. token – אם קיים, נשלח ככותרת Authorization. מחזיר את התשובה או null.
    static JSONObject postJson(String urlStr, JSONObject body, String token) {
        HttpURLConnection c = null;
        try {
            URL url = new URL(urlStr);
            c = (HttpURLConnection) url.openConnection();
            c.setRequestMethod("POST");
            c.setConnectTimeout(15000);
            c.setReadTimeout(15000);
            c.setDoOutput(true);
            c.setRequestProperty("content-type", "application/json");
            if (token != null && !token.isEmpty()) c.setRequestProperty("authorization", "Bearer " + token);
            byte[] out = body.toString().getBytes("UTF-8");
            try (OutputStream os = c.getOutputStream()) { os.write(out); }
            int status = c.getResponseCode();
            java.io.InputStream is = status < 400 ? c.getInputStream() : c.getErrorStream();
            java.io.ByteArrayOutputStream buf = new java.io.ByteArrayOutputStream();
            byte[] tmp = new byte[1024];
            int n;
            while (is != null && (n = is.read(tmp)) != -1) buf.write(tmp, 0, n);
            String resp = buf.toString("UTF-8");
            return resp.isEmpty() ? new JSONObject() : new JSONObject(resp);
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }
}

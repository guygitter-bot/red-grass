package app.matkon;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// "שיתוף ל-mat-kon" מאפליקציה אחרת (אינסטגרם, טיקטוק, דפדפן...): הטקסט/הקישור נשמר עד שהאפליקציה לוקחת אותו (take),
// וכשהיא כבר פתוחה היא מקבלת אירוע "share". האפליקציה תמיד שואלת "להוסיף לספר?" לפני שהיא מוסיפה.
@CapacitorPlugin(name = "ShareTarget")
public class ShareTargetPlugin extends Plugin {
    private static JSObject pending;
    private static ShareTargetPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    static void handle(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null || text.trim().isEmpty()) return;
        String title = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        JSObject data = new JSObject();
        data.put("text", text.length() > 20000 ? text.substring(0, 20000) : text);
        data.put("title", title == null ? "" : title);
        pending = data;
        // שלא יטופל שוב כשהמסך נבנה מחדש (סיבוב מסך)
        intent.setAction(Intent.ACTION_MAIN);
        if (instance != null) instance.notifyListeners("share", new JSObject());
    }

    @PluginMethod
    public void take(PluginCall call) {
        JSObject result = new JSObject();
        if (pending != null) result.put("share", pending);
        pending = null;
        call.resolve(result);
    }
}

package app.kidzfinder;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.Toast;

import org.json.JSONObject;

// לחיצת "אני בסדר 👍" מתוך ההתראה: שולחת לשרת שהילד אישר, ומסירה את ההתראה.
public class CheckinReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(final Context context, Intent intent) {
        final SharedPreferences p = KidPlugin.prefs(context);
        final String familyId = p.getString("familyId", "");
        final String token = p.getString("childToken", "");
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(98);
        Toast.makeText(context, "תודה! עדכנו את ההורים שהכל בסדר", Toast.LENGTH_SHORT).show();
        if (familyId.isEmpty() || token.isEmpty()) return;
        new Thread(() -> {
            KidPlugin.postJson(KidPlugin.API_BASE + "/api/family/" + familyId + "/checkin-reply", new JSONObject(), token);
        }).start();
    }
}

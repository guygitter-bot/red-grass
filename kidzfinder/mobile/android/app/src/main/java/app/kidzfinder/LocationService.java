package app.kidzfinder;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationManager;
import android.media.AudioManager;
import android.media.RingtoneManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

// שירות שרץ ברקע: מציג התראה קבועה שהמיקום משותף, שולח מיקום כל כמה דקות,
// ומושך פקודות מההורה (צלצול / בקשת "אתה בסדר"). שקוף – ההתראה תמיד מוצגת.
public class LocationService extends android.app.Service {

    static final String CH_ONGOING = "kf_sharing";   // ההתראה הקבועה
    static final String CH_ALERT = "kf_alert";        // צלצול ובקשות
    static final int NOTIF_ID = 42;
    static final long INTERVAL_MS = 2 * 60 * 1000;    // שליחה כל 2 דקות (איזון עם סוללה)

    private HandlerThread thread;
    private Handler handler;
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            try { sendLocation(); pollCommands(); } catch (Exception ignored) {}
            if (handler != null) handler.postDelayed(this, INTERVAL_MS);
        }
    };

    public static void start(Context c) {
        Intent i = new Intent(c, LocationService.class);
        ContextCompat.startForegroundService(c, i);
    }
    public static void stop(Context c) {
        c.stopService(new Intent(c, LocationService.class));
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override public void onCreate() {
        super.onCreate();
        createChannels();
        thread = new HandlerThread("kf-loc");
        thread.start();
        handler = new Handler(thread.getLooper());
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        startForegroundNotice();
        if (handler != null) { handler.removeCallbacks(tick); handler.post(tick); }
        return START_STICKY; // המערכת תחזיר את השירות אם נהרג
    }

    @Override public void onDestroy() {
        if (handler != null) handler.removeCallbacks(tick);
        if (thread != null) thread.quitSafely();
        super.onDestroy();
    }

    // ההתראה הקבועה: הילד תמיד רואה שהמיקום משותף
    private void startForegroundNotice() {
        SharedPreferences p = KidPlugin.prefs(this);
        String fam = p.getString("familyName", "המשפחה");
        Notification n = new NotificationCompat.Builder(this, CH_ONGOING)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle("Kidzfinder פעיל")
                .setContentText("המיקום שלך משותף עם " + fam)
                .setOngoing(true)
                .setContentIntent(openAppIntent())
                .build();
        if (Build.VERSION.SDK_INT >= 34) {
            ServiceCompat.startForeground(this, NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIF_ID, n);
        }
    }

    private void sendLocation() {
        SharedPreferences p = KidPlugin.prefs(this);
        String familyId = p.getString("familyId", "");
        String token = p.getString("childToken", "");
        if (familyId.isEmpty() || token.isEmpty()) return;
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) return;

        Location loc = bestLocation();
        if (loc == null) return;
        try {
            JSONObject body = new JSONObject();
            body.put("lat", loc.getLatitude());
            body.put("lng", loc.getLongitude());
            body.put("acc", loc.getAccuracy());
            body.put("battery", batteryLevel());
            JSONObject r = KidPlugin.postJson(KidPlugin.API_BASE + "/api/family/" + familyId + "/loc", body, token);
            if (r != null && !r.has("error")) {
                p.edit().putLong("lastSent", System.currentTimeMillis()).apply();
            }
        } catch (Exception ignored) {}
    }

    // המיקום הטרי ביותר מבין ספקי ה-GPS והרשת
    private Location bestLocation() {
        LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return null;
        Location best = null;
        try {
            for (String prov : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
                Location l = lm.getLastKnownLocation(prov);
                if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
            }
        } catch (SecurityException ignored) {}
        return best;
    }

    private int batteryLevel() {
        BatteryManager bm = (BatteryManager) getSystemService(Context.BATTERY_SERVICE);
        if (bm == null) return -1;
        return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
    }

    // משיכת פקודות מההורה והפעלתן
    private void pollCommands() {
        SharedPreferences p = KidPlugin.prefs(this);
        String familyId = p.getString("familyId", "");
        String token = p.getString("childToken", "");
        if (familyId.isEmpty() || token.isEmpty()) return;
        JSONObject r = KidPlugin.postJson(KidPlugin.API_BASE + "/api/family/" + familyId + "/commands", new JSONObject(), token);
        if (r == null) return;
        JSONObject cmd = r.optJSONObject("command");
        if (cmd == null) return;
        String action = cmd.optString("action", "");
        switch (action) {
            case "ring": loudAlert("ההורים מחפשים אותך", "פתח/י את Kidzfinder"); break;
            case "call": loudAlert("ההורים רוצים לדבר", "התקשר/י אליהם"); break;
            case "checkin": checkinAlert(); break;
        }
    }

    // צליל חזק (ערוץ ההתראה דרך סאונד אזעקה שמתגבר על מצב שקט) + רטט
    private void loudAlert(String title, String text) {
        playAlarm();
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        Notification n = new NotificationCompat.Builder(this, CH_ALERT)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(title)
                .setContentText(text)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setContentIntent(openAppIntent())
                .build();
        if (nm != null) nm.notify(99, n);
    }

    // בקשת "אתה בסדר?" – התראה בולטת עם כפתור "אני בסדר 👍"
    private void checkinAlert() {
        playAlarm();
        Intent i = new Intent(this, CheckinReceiver.class);
        PendingIntent pi = PendingIntent.getBroadcast(this, 0, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        Notification n = new NotificationCompat.Builder(this, CH_ALERT)
                .setSmallIcon(android.R.drawable.ic_menu_help)
                .setContentTitle("ההורים שואלים: אתה בסדר?")
                .setContentText("לחצ/י כדי לומר שהכל בסדר")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setAutoCancel(true)
                .addAction(android.R.drawable.ic_menu_send, "אני בסדר 👍", pi)
                .build();
        if (nm != null) nm.notify(98, n);
    }

    private void playAlarm() {
        try {
            android.net.Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            android.media.Ringtone r = RingtoneManager.getRingtone(getApplicationContext(), uri);
            if (r != null) {
                if (Build.VERSION.SDK_INT >= 28) {
                    r.setAudioAttributes(new android.media.AudioAttributes.Builder()
                            .setUsage(android.media.AudioAttributes.USAGE_ALARM).build());
                }
                r.play();
            }
            android.os.Vibrator v = (android.os.Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) v.vibrate(800);
        } catch (Exception ignored) {}
    }

    private PendingIntent openAppIntent() {
        Intent i = new Intent(this, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, 0, i, PendingIntent.FLAG_IMMUTABLE);
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ongoing = new NotificationChannel(CH_ONGOING, "שיתוף מיקום", NotificationManager.IMPORTANCE_LOW);
        ongoing.setDescription("ההתראה הקבועה שהמיקום משותף");
        NotificationChannel alert = new NotificationChannel(CH_ALERT, "בקשות מההורים", NotificationManager.IMPORTANCE_HIGH);
        alert.setDescription("צלצול ובקשות \"אתה בסדר\"");
        nm.createNotificationChannel(ongoing);
        nm.createNotificationChannel(alert);
    }
}

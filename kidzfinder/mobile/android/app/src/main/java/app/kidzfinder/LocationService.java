package app.kidzfinder;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.media.RingtoneManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

// שירות שרץ ברקע: מציג התראה קבועה שהמיקום משותף, מבקש מיקום פעיל, שולח אותו לשרת,
// ומושך פקודות מההורה (צלצול / בקשת "אתה בסדר"). שקוף – ההתראה תמיד מוצגת.
public class LocationService extends android.app.Service implements LocationListener {

    static final String CH_ONGOING = "kf_sharing";
    static final String CH_ALERT = "kf_alert";
    static final int NOTIF_ID = 42;
    static final long COMMAND_POLL_MS = 60 * 1000;    // משיכת פקודות כל דקה
    static final long MIN_SEND_MS = 60 * 1000;         // שליחת מיקום לכל היותר פעם בדקה
    static final long LOC_UPDATE_MS = 30 * 1000;       // בקשת עדכון מיקום מהמערכת כל 30 שנ׳

    private HandlerThread thread;
    private Handler handler;
    private LocationManager lm;
    private Location lastLoc;      // המיקום הטרי ביותר שהתקבל
    private long lastSendMs = 0;

    // משיכת פקודות + שליחת גיבוי של המיקום האחרון, כל דקה
    private final Runnable poll = new Runnable() {
        @Override public void run() {
            try { pollCommands(); maybeSend(false); } catch (Exception ignored) {}
            if (handler != null) handler.postDelayed(this, COMMAND_POLL_MS);
        }
    };

    public static void start(Context c) {
        ContextCompat.startForegroundService(c, new Intent(c, LocationService.class));
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
        lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        startForegroundNotice();
        requestUpdates();
        if (handler != null) { handler.removeCallbacks(poll); handler.post(poll); }
        return START_STICKY;
    }

    @Override public void onDestroy() {
        if (handler != null) handler.removeCallbacks(poll);
        try { if (lm != null) lm.removeUpdates(this); } catch (Exception ignored) {}
        if (thread != null) thread.quitSafely();
        super.onDestroy();
    }

    // מבקש מהמערכת עדכוני מיקום פעילים (GPS ורשת) – בלי זה "המיקום האחרון" לרוב ריק
    private void requestUpdates() {
        if (lm == null) return;
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) return;
        try {
            for (String prov : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
                if (lm.isProviderEnabled(prov)) {
                    lm.requestLocationUpdates(prov, LOC_UPDATE_MS, 0, this, thread.getLooper());
                    Location last = lm.getLastKnownLocation(prov);
                    if (last != null && (lastLoc == null || last.getTime() > lastLoc.getTime())) lastLoc = last;
                }
            }
        } catch (SecurityException ignored) {}
        maybeSend(true); // ניסיון שליחה ראשוני מיד
    }

    // קריאה מהמערכת כשיש מיקום חדש
    @Override public void onLocationChanged(Location location) {
        lastLoc = location;
        maybeSend(false);
    }
    @Override public void onProviderEnabled(String provider) {}
    @Override public void onProviderDisabled(String provider) {}
    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}

    // שליחת המיקום לשרת (לכל היותר פעם בדקה; force=שליחה ראשונית בלי המתנה)
    private void maybeSend(boolean force) {
        long now = System.currentTimeMillis();
        if (!force && now - lastSendMs < MIN_SEND_MS) return;
        if (lastLoc == null) return;
        android.content.SharedPreferences p = KidPlugin.prefs(this);
        String familyId = p.getString("familyId", "");
        String token = p.getString("childToken", "");
        if (familyId.isEmpty() || token.isEmpty()) return;
        try {
            JSONObject body = new JSONObject();
            body.put("lat", lastLoc.getLatitude());
            body.put("lng", lastLoc.getLongitude());
            body.put("acc", lastLoc.getAccuracy());
            body.put("battery", batteryLevel());
            JSONObject r = KidPlugin.postJson(KidPlugin.API_BASE + "/api/family/" + familyId + "/loc", body, token);
            if (r != null && !r.has("error")) {
                lastSendMs = now;
                p.edit().putLong("lastSent", now).apply();
            }
        } catch (Exception ignored) {}
    }

    private int batteryLevel() {
        BatteryManager bm = (BatteryManager) getSystemService(Context.BATTERY_SERVICE);
        if (bm == null) return -1;
        return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
    }

    // משיכת פקודות מההורה והפעלתן
    private void pollCommands() {
        android.content.SharedPreferences p = KidPlugin.prefs(this);
        String familyId = p.getString("familyId", "");
        String token = p.getString("childToken", "");
        if (familyId.isEmpty() || token.isEmpty()) return;
        JSONObject r = KidPlugin.postJson(KidPlugin.API_BASE + "/api/family/" + familyId + "/commands", new JSONObject(), token);
        if (r == null) return;
        JSONObject cmd = r.optJSONObject("command");
        if (cmd == null) return;
        switch (cmd.optString("action", "")) {
            case "ring": loudAlert("ההורים מחפשים אותך", "פתח/י את Kidzfinder"); break;
            case "call": loudAlert("ההורים רוצים לדבר", "התקשר/י אליהם"); break;
            case "checkin": checkinAlert(); break;
        }
    }

    // ---- התראות ----

    private void startForegroundNotice() {
        String fam = KidPlugin.prefs(this).getString("familyName", "המשפחה");
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

    private void loudAlert(String title, String text) {
        playAlarm();
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        Notification n = new NotificationCompat.Builder(this, CH_ALERT)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(title).setContentText(text)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true).setContentIntent(openAppIntent())
                .build();
        if (nm != null) nm.notify(99, n);
    }

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

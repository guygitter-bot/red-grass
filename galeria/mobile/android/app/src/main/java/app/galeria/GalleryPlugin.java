package app.galeria;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Size;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.label.ImageLabel;
import com.google.mlkit.vision.label.ImageLabeler;
import com.google.mlkit.vision.label.ImageLabeling;
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;

// הגישה לגלריה: רשימת התמונות, ניתוח בתוך הטלפון (טביעת אצבע לתמונות דומות, חדות, בהירות, תוכן),
// תמונות מוקטנות לתצוגה, והעברה לפח של המערכת (אפשר לשחזר 30 יום) – תמיד דרך חלון האישור של אנדרואיד.
// שום תמונה לא יוצאת מהטלפון.
@CapacitorPlugin(
    name = "Gallery",
    permissions = {
        @Permission(alias = "images", strings = { Manifest.permission.READ_MEDIA_IMAGES }),
        @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
    }
)
public class GalleryPlugin extends Plugin {
    // ניתוח – תור אחד (כבד), תמונות מוקטנות – תור נפרד כדי שהמסך לא יחכה לניתוח
    private final ExecutorService analyzePool = Executors.newSingleThreadExecutor();
    private final ExecutorService thumbPool = Executors.newFixedThreadPool(3);
    private ImageLabeler labeler;
    private ActivityResultLauncher<IntentSenderRequest> trashLauncher;
    private PluginCall pendingTrash;

    @Override
    public void load() {
        // נרשם בזמן יצירת המסך (חובה לפני שהוא מוצג)
        trashLauncher = getActivity().registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(),
            result -> {
                PluginCall call = pendingTrash;
                pendingTrash = null;
                if (call == null) return;
                JSObject ret = new JSObject();
                ret.put("done", result.getResultCode() == Activity.RESULT_OK);
                call.resolve(ret);
            }
        );
    }

    private String alias() {
        return Build.VERSION.SDK_INT >= 33 ? "images" : "storage";
    }

    private Uri baseUri() {
        return Build.VERSION.SDK_INT >= 29
            ? MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
            : MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
    }

    private Uri uriOf(String id) {
        return ContentUris.withAppendedId(baseUri(), Long.parseLong(id));
    }

    // ---------- הרשאה ----------

    @PluginMethod
    public void access(PluginCall call) {
        if (getPermissionState(alias()) == PermissionState.GRANTED) {
            accessResult(call);
        } else {
            requestPermissionForAlias(alias(), call, "accessCallback");
        }
    }

    @PermissionCallback
    private void accessCallback(PluginCall call) {
        accessResult(call);
    }

    private void accessResult(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", getPermissionState(alias()) == PermissionState.GRANTED);
        ret.put("canTrash", Build.VERSION.SDK_INT >= 30);
        call.resolve(ret);
    }

    // ---------- רשימת התמונות ----------

    @PluginMethod
    public void list(PluginCall call) {
        analyzePool.execute(() -> {
            try {
                List<String> cols = new ArrayList<>();
                cols.add(MediaStore.Images.Media._ID);
                cols.add(MediaStore.Images.Media.DISPLAY_NAME);
                cols.add(MediaStore.Images.Media.DATE_TAKEN);
                cols.add(MediaStore.Images.Media.DATE_ADDED);
                cols.add(MediaStore.Images.Media.DATE_MODIFIED);
                cols.add(MediaStore.Images.Media.SIZE);
                cols.add(MediaStore.Images.Media.WIDTH);
                cols.add(MediaStore.Images.Media.HEIGHT);
                cols.add(MediaStore.Images.Media.BUCKET_DISPLAY_NAME);
                cols.add(MediaStore.Images.Media.MIME_TYPE);
                if (Build.VERSION.SDK_INT >= 29) cols.add(MediaStore.Images.Media.RELATIVE_PATH);
                if (Build.VERSION.SDK_INT >= 30) cols.add(MediaStore.Images.Media.IS_FAVORITE);
                JSArray items = new JSArray();
                ContentResolver cr = getContext().getContentResolver();
                try (Cursor c = cr.query(baseUri(), cols.toArray(new String[0]), null, null,
                        MediaStore.Images.Media.DATE_ADDED + " DESC")) {
                    if (c != null) {
                        while (c.moveToNext()) {
                            JSObject o = new JSObject();
                            o.put("id", String.valueOf(c.getLong(0)));
                            o.put("name", str(c, 1));
                            long taken = c.isNull(2) ? 0 : c.getLong(2);
                            long added = c.isNull(3) ? 0 : c.getLong(3) * 1000L;
                            o.put("date", taken > 0 ? taken : added);
                            o.put("mod", c.isNull(4) ? 0 : c.getLong(4));
                            o.put("size", c.isNull(5) ? 0 : c.getLong(5));
                            o.put("w", c.isNull(6) ? 0 : c.getInt(6));
                            o.put("h", c.isNull(7) ? 0 : c.getInt(7));
                            o.put("bucket", str(c, 8));
                            o.put("mime", str(c, 9));
                            o.put("path", Build.VERSION.SDK_INT >= 29 ? str(c, 10) : "");
                            o.put("fav", Build.VERSION.SDK_INT >= 30 && !c.isNull(11) && c.getInt(11) == 1);
                            items.put(o);
                        }
                    }
                }
                JSObject ret = new JSObject();
                ret.put("items", items);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("list failed: " + e.getMessage());
            }
        });
    }

    private static String str(Cursor c, int i) {
        String s = c.isNull(i) ? null : c.getString(i);
        return s == null ? "" : s;
    }

    // ---------- ניתוח ----------

    @PluginMethod
    public void analyze(PluginCall call) {
        JSArray ids = call.getArray("ids");
        boolean withLabels = call.getBoolean("labels", true);
        analyzePool.execute(() -> {
            JSArray out = new JSArray();
            try {
                JSONArray arr = ids == null ? new JSONArray() : ids;
                for (int i = 0; i < arr.length(); i++) {
                    String id = arr.getString(i);
                    JSObject o = new JSObject();
                    o.put("id", id);
                    try {
                        Bitmap bmp = loadSmall(uriOf(id), 256);
                        if (bmp == null) throw new Exception("no bitmap");
                        o.put("hash", dHash(bmp));
                        double[] q = quality(bmp);
                        o.put("sharp", Math.round(q[0] * 10) / 10.0);
                        o.put("bright", Math.round(q[1]));
                        if (withLabels) o.put("labels", labels(bmp));
                        bmp.recycle();
                    } catch (Exception e) {
                        o.put("err", true);
                    }
                    out.put(o);
                }
                JSObject ret = new JSObject();
                ret.put("items", out);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("analyze failed: " + e.getMessage());
            }
        });
    }

    private Bitmap loadSmall(Uri uri, int size) throws Exception {
        ContentResolver cr = getContext().getContentResolver();
        Bitmap bmp;
        if (Build.VERSION.SDK_INT >= 29) {
            bmp = cr.loadThumbnail(uri, new Size(size, size), null);
        } else {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            try (InputStream in = cr.openInputStream(uri)) {
                BitmapFactory.decodeStream(in, null, bounds);
            }
            int sample = 1;
            while (Math.max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= size) sample *= 2;
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inSampleSize = sample;
            try (InputStream in = cr.openInputStream(uri)) {
                bmp = BitmapFactory.decodeStream(in, null, opts);
            }
        }
        if (bmp != null && Build.VERSION.SDK_INT >= 26 && bmp.getConfig() == Bitmap.Config.HARDWARE) {
            bmp = bmp.copy(Bitmap.Config.ARGB_8888, false);
        }
        return bmp;
    }

    private static int lum(int p) {
        return (((p >> 16) & 0xff) * 299 + ((p >> 8) & 0xff) * 587 + (p & 0xff) * 114) / 1000;
    }

    // טביעת אצבע (dHash, 64 סיביות): תמונות דומות → מעט סיביות שונות
    private static String dHash(Bitmap bmp) {
        Bitmap s = Bitmap.createScaledBitmap(bmp, 9, 8, true);
        long h = 0;
        for (int y = 0; y < 8; y++) {
            for (int x = 0; x < 8; x++) {
                h = (h << 1) | (lum(s.getPixel(x, y)) > lum(s.getPixel(x + 1, y)) ? 1 : 0);
            }
        }
        if (s != bmp) s.recycle();
        return String.format(Locale.US, "%016x", h);
    }

    // חדות (שונות של לפלסיאן – נמוך = מטושטש) ובהירות ממוצעת (0–255)
    private static double[] quality(Bitmap bmp) {
        int n = 128;
        Bitmap s = Bitmap.createScaledBitmap(bmp, n, n, true);
        int[] px = new int[n * n];
        s.getPixels(px, 0, n, 0, 0, n, n);
        if (s != bmp) s.recycle();
        int[] g = new int[n * n];
        double sum = 0;
        for (int i = 0; i < px.length; i++) {
            g[i] = lum(px[i]);
            sum += g[i];
        }
        double mean = 0, sq = 0;
        int count = 0;
        for (int y = 1; y < n - 1; y++) {
            for (int x = 1; x < n - 1; x++) {
                int i = y * n + x;
                int l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - n] - g[i + n];
                mean += l;
                sq += (double) l * l;
                count++;
            }
        }
        mean /= count;
        return new double[] { sq / count - mean * mean, sum / px.length };
    }

    private JSArray labels(Bitmap bmp) {
        JSArray out = new JSArray();
        try {
            if (labeler == null) {
                labeler = ImageLabeling.getClient(
                    new ImageLabelerOptions.Builder().setConfidenceThreshold(0.55f).build()
                );
            }
            List<ImageLabel> list = Tasks.await(labeler.process(InputImage.fromBitmap(bmp, 0)));
            int k = 0;
            for (ImageLabel l : list) {
                if (k++ >= 6) break;
                JSArray pair = new JSArray();
                pair.put(l.getText());
                pair.put(Math.round(l.getConfidence() * 100) / 100.0);
                out.put(pair);
            }
        } catch (Exception e) {
            // בלי תוויות – התמונה תסווג לפי המקור בלבד
        }
        return out;
    }

    // ---------- תמונה מוקטנת לתצוגה ----------

    @PluginMethod
    public void thumb(PluginCall call) {
        String id = call.getString("id");
        int size = call.getInt("size", 300);
        thumbPool.execute(() -> {
            try {
                Bitmap bmp = loadSmall(uriOf(id), size);
                if (bmp == null) throw new Exception("no bitmap");
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                bmp.compress(Bitmap.CompressFormat.JPEG, size > 600 ? 85 : 72, bos);
                bmp.recycle();
                JSObject ret = new JSObject();
                ret.put("src", "data:image/jpeg;base64," + Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP));
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("thumb failed");
            }
        });
    }

    // ---------- פתיחה בגלריה של הטלפון ----------

    @PluginMethod
    public void open(PluginCall call) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uriOf(call.getString("id")), "image/*");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("open failed");
        }
    }

    // ---------- העברה לפח (המערכת שואלת את המשתמשת) ----------

    @PluginMethod
    public void trash(PluginCall call) {
        if (Build.VERSION.SDK_INT < 30) {
            call.reject("old android", "OLD_ANDROID");
            return;
        }
        if (pendingTrash != null) {
            call.reject("busy", "BUSY");
            return;
        }
        try {
            JSONArray ids = call.getArray("ids");
            List<Uri> uris = new ArrayList<>();
            for (int i = 0; i < ids.length(); i++) uris.add(uriOf(ids.getString(i)));
            if (uris.isEmpty()) {
                JSObject ret = new JSObject();
                ret.put("done", true);
                call.resolve(ret);
                return;
            }
            PendingIntent pi = MediaStore.createTrashRequest(getContext().getContentResolver(), uris, true);
            pendingTrash = call;
            trashLauncher.launch(new IntentSenderRequest.Builder(pi.getIntentSender()).build());
        } catch (Exception e) {
            pendingTrash = null;
            call.reject("trash failed: " + e.getMessage());
        }
    }
}

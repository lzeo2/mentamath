package com.mentamath.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {
    private static final String APP_VERSION = "1.6";
    private static final String VERSION_URL = "https://lzeo2.github.io/mentamath/version.json";

    private WebView webView;
    private DownloadManager downloadManager;
    private long downloadId = -1;
    private String pendingApkUrl = null;

    private final BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            if (id != downloadId || pendingApkUrl == null) {
                return;
            }
            Uri uri = downloadManager.getUriForDownloadedFile(id);
            if (uri == null) {
                toast("Update download failed - try again");
                return;
            }
            Intent install = new Intent(Intent.ACTION_VIEW);
            install.setDataAndType(uri, "application/vnd.android.package-archive");
            install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                startActivity(install);
            } catch (Exception e) {
                toast("Couldn't open installer: " + e.getMessage());
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl("file:///android_asset/index.html");

        // Updater setup — must NEVER block the app if something goes wrong.
        try {
            downloadManager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
            if (android.os.Build.VERSION.SDK_INT >= 33) {
                // Android 14+ (targetSdk 34) REQUIRES an export flag or the
                // registration throws SecurityException and the app crashes.
                registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                registerReceiver(downloadReceiver, filter);
            }
            checkForUpdates();
        } catch (Exception e) {
            // updater failure must not prevent the app from opening
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        try {
            unregisterReceiver(downloadReceiver);
        } catch (Exception ignored) {
        }
    }

    private void checkForUpdates() {
        new Thread(new Runnable() {
            @Override
            public void run() {
                String remote = fetch(VERSION_URL);
                if (remote == null) {
                    return;
                }
                try {
                    JSONObject j = new JSONObject(remote);
                    final String latest = j.optString("version", "");
                    final String apkUrl = j.optString("apk", "");
                    if (latest.isEmpty() || apkUrl.isEmpty() || latest.equals(APP_VERSION)) {
                        return;
                    }
                    if (isNewer(latest, APP_VERSION)) {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                promptUpdate(latest, apkUrl);
                            }
                        });
                    }
                } catch (Exception ignored) {
                }
            }
        }).start();
    }

    private void promptUpdate(final String version, final String apkUrl) {
        new AlertDialog.Builder(this)
                .setTitle("Update available")
                .setMessage("Mentamath v" + version + " is ready (you have v" + APP_VERSION + ").\nDownload and install it now?")
                .setPositiveButton("Update", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        startDownload(apkUrl);
                    }
                })
                .setNegativeButton("Later", null)
                .show();
    }

    private void startDownload(String apkUrl) {
        pendingApkUrl = apkUrl;
        DownloadManager.Request req = new DownloadManager.Request(Uri.parse(apkUrl));
        req.setTitle("Mentamath update");
        req.setDescription("Downloading new version...");
        req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        try {
            downloadId = downloadManager.enqueue(req);
        } catch (Exception e) {
            toast("Couldn't start download: " + e.getMessage());
        }
    }

    private boolean isNewer(String a, String b) {
        String[] pa = a.split("\\.");
        String[] pb = b.split("\\.");
        int n = Math.max(pa.length, pb.length);
        for (int i = 0; i < n; i++) {
            int va = i < pa.length ? parseIntSafe(pa[i]) : 0;
            int vb = i < pb.length ? parseIntSafe(pb[i]) : 0;
            if (va != vb) {
                return va > vb;
            }
        }
        return false;
    }

    private int parseIntSafe(String s) {
        try {
            return Integer.parseInt(s.trim());
        } catch (Exception e) {
            return 0;
        }
    }

    private String fetch(String urlStr) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setInstanceFollowRedirects(true);
            int code = conn.getResponseCode();
            if (code != 200) {
                return null;
            }
            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            reader.close();
            return sb.toString();
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}

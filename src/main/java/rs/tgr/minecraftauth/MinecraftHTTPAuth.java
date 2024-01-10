package rs.tgr.minecraftauth;

import org.bukkit.event.player.AsyncPlayerPreLoginEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.event.*;

import java.nio.charset.StandardCharsets;
import java.io.*;
import java.net.*;

public class MinecraftHTTPAuth extends JavaPlugin implements Listener {
    private static final int TIMEOUT_MS = 300000;
    private static final String host = "mcauth.local:1337";

    @Override
    public void onEnable() {
        getServer().getPluginManager().registerEvents(this, this);
    }

    @EventHandler
    public void onAsyncPlayerPreLogin(AsyncPlayerPreLoginEvent event) {
        String message = "Auth service unavailable";
        HttpURLConnection con = null;

        try {
            String name = URLEncoder.encode(event.getName(), "UTF-8");
            String ip = URLEncoder.encode(event.getAddress().getHostAddress(), "UTF-8");
            String uuid = URLEncoder.encode(event.getUniqueId().toString(), "UTF-8");
            String urlString = "http://" + host + "/?name=" + name + "&ip=" + ip + "&uuid=" + uuid;

            con = (HttpURLConnection) new URL(urlString).openConnection();
            con.setRequestMethod("POST");
            con.setConnectTimeout(TIMEOUT_MS);
            con.setReadTimeout(TIMEOUT_MS);

            int status = con.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) {
                throw new IOException("Unexpected response code: " + status);
            }

            InputStream in = con.getInputStream();
            byte[] answer = new byte[1024];
            int readBytes = in.read(answer);
            if (readBytes == -1) {
                throw new IOException("No response from authentication server");
            }

            message = new String(answer, StandardCharsets.UTF_8);
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            if (con != null) {
                con.disconnect();
            }
        }

        if (!"OK".equals(message)) {
            event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_OTHER, message);
        }
    }
}

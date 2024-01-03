package rs.tgr.minecraftauth;

import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerPreLoginEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;

public class MinecraftHTTPAuth extends JavaPlugin implements Listener {
    @Override
    public void onEnable() {
        getServer().getPluginManager().registerEvents(this, this);
    }

    @EventHandler
    public void onAsyncPlayerPreLogin(AsyncPlayerPreLoginEvent event) {
        try {
            String urlString = "http://mcauth.local:1337/?name=" +
                    URLEncoder.encode(event.getName(), "UTF-8") +
                    "&ip=" + URLEncoder.encode(event.getAddress().getHostAddress(), "UTF-8") +
                    "&uuid=" + URLEncoder.encode(event.getUniqueId().toString(), "UTF-8");

            URL url = new URL(urlString);
            HttpURLConnection con = (HttpURLConnection) url.openConnection();
            con.setRequestMethod("GET");

            int status = con.getResponseCode();
            assert status == HttpURLConnection.HTTP_OK : "Unexpected response code: " + status;

            BufferedReader in = new BufferedReader(new InputStreamReader(con.getInputStream()));
            String inputLine;
            StringBuilder content = new StringBuilder();
            while ((inputLine = in.readLine()) != null) {
                content.append(inputLine);
            }
            in.close();

            String answer = content.toString();

            if (!"OK".equals(answer)) {
                event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_OTHER, answer);
            }
        } catch (Exception e) {
            e.printStackTrace();
            event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_OTHER, "Auth service unavailable");
        }
    }
}

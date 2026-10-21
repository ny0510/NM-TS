package kr.nm.hls;

import com.sedmelluq.discord.lavaplayer.player.AudioPlayer;
import com.sedmelluq.discord.lavaplayer.player.DefaultAudioPlayerManager;
import com.sedmelluq.discord.lavaplayer.player.event.AudioEventAdapter;
import com.sedmelluq.discord.lavaplayer.source.http.HttpAudioSourceManager;
import com.sedmelluq.discord.lavaplayer.tools.FriendlyException;
import com.sedmelluq.discord.lavaplayer.tools.io.HttpClientTools;
import com.sedmelluq.discord.lavaplayer.track.AudioItem;
import com.sedmelluq.discord.lavaplayer.track.AudioTrack;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import lavalink.server.config.HttpConfig;
import lavalink.server.config.ServerConfig;

public final class RadioAudioTest {
  public static void main(String[] args) throws Exception {
    HttpClientTools.setDefaultRequestTimeout(10000, 10000, 30000);
    if (args.length > 1 && "--live".equals(args[0])) {
      for (int i = 1; i < args.length; i++) {
        int target = Integer.getInteger("nm.test.frames", 50);
        int frames = decode(args[i], true, target, true);
        require(frames >= target, "Live stream " + i + " decoded " + frames + " frames");
        System.out.println("live[" + i + "] frames=" + frames);
      }
      return;
    }
    Path fixtures = Path.of(args[0]);
    byte[] aac = Files.readAllBytes(fixtures.resolve("tone.aac"));
    byte[] ts = Files.readAllBytes(fixtures.resolve("tone.ts"));
    byte[] emptyTs = java.util.Arrays.copyOf(ts, ts.length + 188);
    java.util.Arrays.fill(emptyTs, ts.length, emptyTs.length, (byte) 0xff);
    emptyTs[ts.length] = 0x47;
    emptyTs[ts.length + 1] = 1;
    emptyTs[ts.length + 2] = 0;
    emptyTs[ts.length + 3] = 0x30;
    emptyTs[ts.length + 4] = (byte) 183;
    emptyTs[ts.length + 5] = 0;
    byte[] adaptationOnlyTs = emptyTs.clone();
    adaptationOnlyTs[ts.length + 3] = 0x20;
    byte[] id3 = new byte[aac.length + 10];
    System.arraycopy(new byte[]{'I', 'D', '3', 4, 0, 0, 0, 0, 0, 0}, 0, id3, 0, 10);
    System.arraycopy(aac, 0, id3, 10, aac.length);
    Set<Integer> proxyConnections = ConcurrentHashMap.newKeySet();
    AtomicInteger proxyRequests = new AtomicInteger();
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/", exchange -> {
      if (!exchange.getRequestHeaders().getFirst("Host").startsWith("127.0.0.1")) {
        proxyConnections.add(exchange.getRemoteAddress().getPort());
        proxyRequests.incrementAndGet();
      }
      String path = exchange.getRequestURI().getPath();
      byte[] body;
      if (path.endsWith("master.m3u8")) {
        body = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=128000\nplaylist.m3u8\n".getBytes(StandardCharsets.UTF_8);
      } else if (path.endsWith("playlist.m3u8")) {
        body = "#EXTM3U\n#EXT-X-TARGETDURATION:3\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:2.0,\nsegment1\n#EXTINF:2.0,\nsegment2\n#EXT-X-ENDLIST\n".getBytes(StandardCharsets.UTF_8);
      } else {
        body = path.startsWith("/empty-ts/") ? emptyTs : path.startsWith("/adaptation-only-ts/") ? adaptationOnlyTs
            : path.startsWith("/ts/") ? ts : path.startsWith("/id3/") ? id3 : aac;
      }
      exchange.getResponseHeaders().set("Content-Type", path.endsWith("m3u8") ? "application/vnd.apple.mpegurl" : "application/octet-stream");
      exchange.sendResponseHeaders(200, body.length);
      try (var output = exchange.getResponseBody()) {
        output.write(body);
      }
    });
    server.start();
    try {
      String base = "http://127.0.0.1:" + server.getAddress().getPort();
      require(decode(base + "/aac/playlist.m3u8", false, 150, false) == 0, "Expected baseline AAC playback failure");
      for (String format : new String[]{"aac", "id3", "ts", "empty-ts", "adaptation-only-ts"}) {
        for (String playlist : new String[]{"playlist.m3u8", "master.m3u8"}) {
          int frames = decode(base + "/" + format + "/" + playlist, true, 150, false);
          require(frames >= 150, format + " / " + playlist + " decoded " + frames + " frames");
          System.out.println(format + " / " + playlist + " frames=" + frames);
        }
      }
      ServerConfig proxyConfig = new ServerConfig();
      proxyConfig.setHttpConfig(new HttpConfig("127.0.0.1", server.getAddress().getPort(), "", ""));
      for (String host : new String[]{"ebsonair.ebs.co.kr", "live.andongmbc.co.kr", "onairsfm.jejumbc.com", "ordinary.invalid"}) {
        proxyConnections.clear();
        proxyRequests.set(0);
        require(decode("http://" + host + "/aac/master.m3u8", true, 150, false, proxyConfig) >= 150,
            "Proxied playback failed: " + host);
        require(proxyRequests.get() >= 4, "HLS requests bypassed the configured proxy");
        boolean reused = proxyConnections.size() < proxyRequests.get();
        require(reused == "ordinary.invalid".equals(host), "Unexpected HTTP connection reuse: " + host);
        System.out.println(host + " proxy requests=" + proxyRequests.get() + " connections=" + proxyConnections.size());
      }
    } finally {
      server.stop(0);
    }
  }

  static int decode(String url, boolean adaptive, int target, boolean realtime) throws Exception {
    return decode(url, adaptive, target, realtime, new ServerConfig());
  }

  private static int decode(String url, boolean adaptive, int target, boolean realtime, ServerConfig config) throws Exception {
    DefaultAudioPlayerManager manager = new DefaultAudioPlayerManager();
    RadioAudioConfiguration plugin = new RadioAudioConfiguration(config);
    if (adaptive) {
      plugin.configure(manager);
    }
    manager.registerSourceManager(new HttpAudioSourceManager());
    AudioPlayer player = manager.createPlayer();
    AtomicReference<FriendlyException> error = new AtomicReference<>();
    player.addListener(new AudioEventAdapter() {
      @Override
      public void onTrackException(AudioPlayer player, AudioTrack track, FriendlyException exception) {
        error.set(exception);
      }
    });
    try {
      AudioItem item = manager.loadItemSync(url);
      require(item instanceof AudioTrack, "No audio track loaded");
      player.playTrack((AudioTrack) item);
      int frames = 0;
      long deadline = System.nanoTime() + (target * 20L + 45_000L) * 1_000_000L;
      while (frames < target && System.nanoTime() < deadline) {
        if (error.get() != null) {
          Throwable cause = error.get();
          while (cause.getCause() != null) {
            cause = cause.getCause();
          }
          throw new AssertionError("Playback failed: " + cause.getClass().getSimpleName() + ": " + cause.getMessage());
        }
        if (player.provide() != null) {
          frames++;
          if (realtime) {
            Thread.sleep(20);
          }
        } else if (player.getPlayingTrack() == null) {
          break;
        } else {
          Thread.sleep(10);
        }
      }
      return frames;
    } finally {
      player.destroy();
      manager.shutdown();
      plugin.destroy();
    }
  }

  private static void require(boolean condition, String message) {
    if (!condition) {
      throw new AssertionError(message);
    }
  }
}

package kr.nm.hls;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicInteger;
import com.sedmelluq.discord.lavaplayer.player.DefaultAudioPlayerManager;
import com.sedmelluq.discord.lavaplayer.tools.io.HttpClientTools;
import com.sedmelluq.discord.lavaplayer.track.AudioTrackInfo;

public final class IfmHlsTest {
  public static void main(String[] args) throws Exception {
    Path fixtures = Path.of(args[0]);
    AtomicInteger missing = new AtomicInteger();
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/", exchange -> {
      String path = exchange.getRequestURI().getPath();
      byte[] body;
      if (path.equals("/station/master.m3u8")) {
        body = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=128000\n/audio/playlist.m3u8\n".getBytes(StandardCharsets.UTF_8);
      } else if (path.equals("/station/path-master.m3u8")) {
        body = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=128000\n../audio/playlist.m3u8\n".getBytes(StandardCharsets.UTF_8);
      } else if (path.equals("/station/absolute-master.m3u8")) {
        body = ("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=128000\nhttp://127.0.0.1:" + server.getAddress().getPort()
            + "/audio/playlist.m3u8\n").getBytes(StandardCharsets.UTF_8);
      } else if (path.equals("/station/query-master.m3u8")) {
        body = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=128000\n/query/playlist.m3u8?token=fixture\n".getBytes(StandardCharsets.UTF_8);
      } else if (path.equals("/query/playlist.m3u8") && "token=fixture".equals(exchange.getRequestURI().getRawQuery())) {
        body = "#EXTM3U\n#EXT-X-TARGETDURATION:2\n#EXTINF:2,\none.aac?token=fixture\n#EXTINF:2,\ntwo.aac?token=fixture\n#EXT-X-ENDLIST\n".getBytes(StandardCharsets.UTF_8);
      } else if ((path.equals("/query/one.aac") || path.equals("/query/two.aac")) && "token=fixture".equals(exchange.getRequestURI().getRawQuery())) {
        body = Files.readAllBytes(fixtures.resolve("tone.aac"));
      } else if (path.equals("/audio/playlist.m3u8")) {
        body = "#EXTM3U\n#EXT-X-TARGETDURATION:2\n#EXTINF:2,\n/audio/one.aac\n#EXTINF:2,\n/audio/two.aac\n#EXT-X-ENDLIST\n".getBytes(StandardCharsets.UTF_8);
      } else if (path.equals("/audio/one.aac") || path.equals("/audio/two.aac")) {
        body = Files.readAllBytes(fixtures.resolve("tone.aac"));
      } else if (path.equals("/mp4/master.m3u8")) {
        body = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=128000\n/mp4/playlist.m3u8\n".getBytes(StandardCharsets.UTF_8);
      } else if (path.startsWith("/mp4/") && Files.isRegularFile(fixtures.resolve("mp4").resolve(path.substring(5)))) {
        body = Files.readAllBytes(fixtures.resolve("mp4").resolve(path.substring(5)));
      } else {
        missing.incrementAndGet();
        exchange.sendResponseHeaders(404, -1);
        exchange.close();
        return;
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
      String[] paths = args.length > 1 ? new String[]{"/mp4/playlist.m3u8"}
          : new String[]{"/station/master.m3u8", "/station/path-master.m3u8", "/station/absolute-master.m3u8",
              "/station/query-master.m3u8", "/mp4/master.m3u8", "/mp4/playlist.m3u8"};
      for (String path : paths) {
        int frames = RadioAudioTest.decode(base + path, true, 150, false);
        if (frames < 150 || missing.get() != 0) {
          throw new AssertionError(path + " frames=" + frames + " unexpected404=" + missing.get());
        }
        System.out.println(path + " frames=" + frames + " unexpected404=" + missing.get());
      }
      if (args.length == 1) {
        decodeInner(base + "/mp4/playlist.m3u8");
      }
    } finally {
      server.stop(0);
    }
  }

  private static void decodeInner(String url) throws Exception {
    DefaultAudioPlayerManager manager = new DefaultAudioPlayerManager();
    var player = manager.createPlayer();
    var http = HttpClientTools.createDefaultThreadLocalManager();
    try {
      var info = new AudioTrackInfo("fixture", "fixture", Long.MAX_VALUE, url, true, url);
      player.playTrack(new AdaptiveM3uProbe(http).createTrack("hls-inner", info, null));
      int frames = 0;
      long deadline = System.nanoTime() + 10_000_000_000L;
      while (frames < 150 && System.nanoTime() < deadline && player.getPlayingTrack() != null) {
        if (player.provide() != null) {
          frames++;
        } else {
          Thread.sleep(10);
        }
      }
      if (frames < 150) {
        throw new AssertionError("Explicit hls-inner decoded " + frames + " frames");
      }
      System.out.println("explicit hls-inner fMP4 frames=" + frames);
    } finally {
      player.destroy();
      manager.shutdown();
      http.close();
    }
  }
}

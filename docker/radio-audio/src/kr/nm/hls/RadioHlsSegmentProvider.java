package kr.nm.hls;

import com.sedmelluq.discord.lavaplayer.container.playlists.ExtendedM3uParser;
import com.sedmelluq.discord.lavaplayer.container.playlists.HlsStreamSegmentUrlProvider;
import com.sedmelluq.discord.lavaplayer.tools.io.HttpClientTools;
import com.sedmelluq.discord.lavaplayer.tools.io.HttpInterface;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import org.apache.http.client.methods.HttpGet;

final class RadioHlsSegmentProvider extends HlsStreamSegmentUrlProvider {
  private final URI origin;
  private String initialization;
  private boolean initializationSent;
  private String pendingSegment;

  RadioHlsSegmentProvider(String url, boolean inner) {
    super(inner ? null : url, inner ? url : null);
    origin = URI.create(url);
  }

  @Override
  protected String getAbsoluteUrl(String url) {
    return origin.resolve(url).toString();
  }

  @Override
  protected List<SegmentInfo> loadStreamSegmentsList(HttpInterface http, String playlist) throws IOException {
    List<SegmentInfo> segments = new ArrayList<>();
    Long duration = null;
    for (String text : HttpClientTools.fetchResponseLines(http, new HttpGet(playlist), "stream segments list")) {
      ExtendedM3uParser.Line line = ExtendedM3uParser.parseLine(text);
      if (line.isDirective()) {
        if ("EXT-X-MAP".equals(line.directiveName)) {
          String path = line.directiveArguments.get("URI");
          if (path == null || line.directiveArguments.containsKey("BYTERANGE")) {
            throw new IOException("Unsupported HLS initialization map");
          }
          String resolved = URI.create(playlist).resolve(path).toString();
          if (initializationSent && !resolved.equals(initialization)) {
            throw new IOException("HLS initialization changed during playback");
          }
          initialization = resolved;
        } else if ("EXT-X-BYTERANGE".equals(line.directiveName)
            || "EXT-X-KEY".equals(line.directiveName) && !"NONE".equals(line.directiveArguments.get("METHOD"))) {
          throw new IOException("Encrypted or byte-range HLS is not supported");
        } else if ("EXTINF".equals(line.directiveName)) {
          try {
            duration = (long) (Double.parseDouble(line.extraData.split(",", 2)[0]) * 1000);
          } catch (NumberFormatException ignored) {
            duration = null;
          }
        }
      } else if (line.isData()) {
        segments.add(new SegmentInfo(line.lineData, duration, null));
        duration = null;
      }
    }
    return segments;
  }

  @Override
  protected String getNextSegmentUrl(HttpInterface http) {
    if (pendingSegment != null) {
      String next = pendingSegment;
      pendingSegment = null;
      return next;
    }
    String next = super.getNextSegmentUrl(http);
    if (next != null && initialization != null && !initializationSent) {
      initializationSent = true;
      pendingSegment = next;
      return initialization;
    }
    return next;
  }
}

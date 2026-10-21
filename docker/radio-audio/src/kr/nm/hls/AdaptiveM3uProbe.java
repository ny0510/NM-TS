package kr.nm.hls;

import com.sedmelluq.discord.lavaplayer.container.adts.AdtsAudioTrack;
import com.sedmelluq.discord.lavaplayer.container.mpeg.MpegAudioTrack;
import com.sedmelluq.discord.lavaplayer.container.playlists.HlsStreamTrack;
import com.sedmelluq.discord.lavaplayer.container.playlists.M3uPlaylistContainerProbe;
import com.sedmelluq.discord.lavaplayer.tools.FriendlyException;
import com.sedmelluq.discord.lavaplayer.tools.io.HttpInterfaceManager;
import com.sedmelluq.discord.lavaplayer.tools.io.SeekableInputStream;
import com.sedmelluq.discord.lavaplayer.tools.io.NonSeekableInputStream;
import com.sedmelluq.discord.lavaplayer.source.stream.M3uStreamSegmentUrlProvider;
import com.sedmelluq.discord.lavaplayer.track.AudioTrack;
import com.sedmelluq.discord.lavaplayer.track.AudioTrackInfo;
import com.sedmelluq.discord.lavaplayer.track.playback.LocalAudioTrackExecutor;
import java.io.InputStream;
import java.io.PushbackInputStream;

final class AdaptiveM3uProbe extends M3uPlaylistContainerProbe {
  private final HttpInterfaceManager http;

  AdaptiveM3uProbe(HttpInterfaceManager http) {
    this.http = http;
  }

  @Override
  public AudioTrack createTrack(String parameters, AudioTrackInfo info, SeekableInputStream input) {
    if (!"hls-inner".equals(parameters) && !"hls-outer".equals(parameters)) {
      return super.createTrack(parameters, info, input);
    }
    return new HlsStreamTrack(info, info.identifier, http, "hls-inner".equals(parameters)) {
      private final RadioHlsSegmentProvider segments = new RadioHlsSegmentProvider(info.identifier, "hls-inner".equals(parameters));

      @Override
      protected M3uStreamSegmentUrlProvider getSegmentUrlProvider() {
        return segments;
      }

      @Override
      protected void processJoinedStream(LocalAudioTrackExecutor executor, InputStream stream) throws Exception {
        PushbackInputStream input = new PushbackInputStream(stream, 8);
        byte[] header = input.readNBytes(8);
        input.unread(header);
        if (header.length > 0 && header[0] == 0x47) {
          super.processJoinedStream(executor, new TsPayloadInputStream(input));
        } else if (isAdts(header)) {
          processDelegate(new AdtsAudioTrack(trackInfo, input), executor);
        } else if (header.length == 8 && header[4] == 'f' && header[5] == 't' && header[6] == 'y' && header[7] == 'p') {
          processDelegate(new MpegAudioTrack(trackInfo, new NonSeekableInputStream(input)), executor);
        } else {
          throw new FriendlyException("Unsupported HLS audio segment format.", FriendlyException.Severity.COMMON, null);
        }
      }
    };
  }

  private static boolean isAdts(byte[] header) {
    return header.length >= 3 && header[0] == 'I' && header[1] == 'D' && header[2] == '3'
        || header.length >= 2 && (header[0] & 0xff) == 0xff && (header[1] & 0xf6) == 0xf0;
  }
}

package kr.nm.hls;

import com.sedmelluq.discord.lavaplayer.container.adts.AdtsAudioTrack;
import com.sedmelluq.discord.lavaplayer.container.playlists.HlsStreamTrack;
import com.sedmelluq.discord.lavaplayer.container.playlists.M3uPlaylistContainerProbe;
import com.sedmelluq.discord.lavaplayer.tools.FriendlyException;
import com.sedmelluq.discord.lavaplayer.tools.io.HttpInterfaceManager;
import com.sedmelluq.discord.lavaplayer.tools.io.SeekableInputStream;
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
      @Override
      protected void processJoinedStream(LocalAudioTrackExecutor executor, InputStream stream) throws Exception {
        PushbackInputStream input = new PushbackInputStream(stream, 3);
        byte[] header = input.readNBytes(3);
        input.unread(header);
        if (header.length > 0 && header[0] == 0x47) {
          super.processJoinedStream(executor, input);
        } else if (isAdts(header)) {
          processDelegate(new AdtsAudioTrack(trackInfo, input), executor);
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

package kr.nm.hls;

import java.io.IOException;
import java.io.InputStream;
import java.util.Objects;

/** Omits empty TS packets which Lavaplayer 2.2.6 incorrectly exposes as elementary data. */
final class TsPayloadInputStream extends InputStream {
  private final InputStream input;
  private final byte[] packet = new byte[188];
  private int position;
  private int limit;

  TsPayloadInputStream(InputStream input) {
    this.input = input;
  }

  private boolean availablePacket() throws IOException {
    while (position == limit) {
      limit = input.readNBytes(packet, 0, packet.length);
      position = 0;
      if (limit == 0) {
        return false;
      }
      int adaptation = (packet[3] >>> 4) & 3;
      if (limit == packet.length && packet[0] == 0x47
          && (adaptation == 2 || adaptation == 3 && (packet[4] & 0xff) == 183)) {
        position = limit;
      }
    }
    return true;
  }

  @Override
  public int read() throws IOException {
    return availablePacket() ? packet[position++] & 0xff : -1;
  }

  @Override
  public int read(byte[] bytes, int offset, int length) throws IOException {
    Objects.checkFromIndexSize(offset, length, bytes.length);
    if (length == 0) {
      return 0;
    }
    if (!availablePacket()) {
      return -1;
    }
    int count = Math.min(length, limit - position);
    System.arraycopy(packet, position, bytes, offset, count);
    position += count;
    return count;
  }

  @Override
  public void close() throws IOException {
    input.close();
  }
}

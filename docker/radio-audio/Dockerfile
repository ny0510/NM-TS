FROM ghcr.io/lavalink-devs/lavalink:4.2.2-alpine AS lavalink

FROM eclipse-temurin:17-jdk AS plugin-builder
WORKDIR /build
COPY --from=lavalink /opt/Lavalink/Lavalink.jar ./
RUN jar -xf Lavalink.jar BOOT-INF/lib BOOT-INF/classes
COPY src ./src
COPY resources ./resources
RUN mkdir classes && javac --release 17 -cp 'BOOT-INF/lib/*:BOOT-INF/classes' -d classes $(find src -name '*.java') \
    && jar --create --file nm-hls.jar -C classes . -C resources .

FROM lavalink
COPY --from=plugin-builder /build/nm-hls.jar /opt/Lavalink/nm-plugin/nm-hls.jar
COPY --chmod=755 start.sh /opt/Lavalink/start-radio.sh
ENTRYPOINT ["/opt/Lavalink/start-radio.sh"]

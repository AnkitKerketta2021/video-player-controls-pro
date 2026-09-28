import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const SEEK_SECONDS = 10;
const POSITION_KEY = "project14-video-positions";

const VIDEO_LIST = [
  {
    id: "video-01",
    title: "Blue Horizon",
    src: "https://www.pexels.com/download/video/3635192/",
    accent: "blue",
  },
  {
    id: "video-02",
    title: "Red Car",
    src: "https://www.pexels.com/download/video/36223712/",
    accent: "red",
  },
  {
    id: "video-03",
    title: "Snow",
    src: "https://www.pexels.com/download/video/6235582/",
    accent: "blue",
  },
  {
    id: "video-04",
    title: "White Horse",
    src: "https://www.pexels.com/download/video/8624879/",
    accent: "red",
  },
];

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";

  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(
    2,
    "0",
  )}`;
}

function readSavedPositions() {
  try {
    const saved = localStorage.getItem(POSITION_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function writeSavedPositions(positions) {
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(positions));
  } catch {
    // localStorage can be unavailable in privacy-restricted environments.
  }
}

/**
 * Reusable play/pause control.
 */
function PlayButton({ isPlaying, onClick }) {
  return (
    <button
      type="button"
      className="control-button control-button--main"
      onClick={onClick}
      aria-label={isPlaying ? "Pause video" : "Play video"}
      title={isPlaying ? "Pause" : "Play"}
    >
      {isPlaying ? "⏸" : "▶"}
    </button>
  );
}

/**
 * Reusable +/- 10 second seek control.
 */
function SeekButton({ direction, onClick }) {
  const isForward = direction === "forward";

  return (
    <button
      type="button"
      className="control-button"
      onClick={onClick}
      aria-label={`${isForward ? "Forward" : "Back"} ${SEEK_SECONDS} seconds`}
      title={`${isForward ? "Forward" : "Back"} ${SEEK_SECONDS}s`}
    >
      <span>{isForward ? "↻" : "↶"}</span>
      <small>{SEEK_SECONDS}</small>
    </button>
  );
}

/**
 * Reusable previous/next button.
 * The thumbnail is rendered only while hovering/focusing the button.
 */
function NavigationButton({
  direction,
  disabled,
  title,
  thumbnail,
  onClick,
}) {
  const isNext = direction === "next";

  return (
    <button
      type="button"
      className={`navigation-button navigation-button--${direction}`}
      disabled={disabled}
      onClick={onClick}
      aria-label={title}
    >
      <span>{isNext ? "›" : "‹"}</span>
      <strong>{title}</strong>

      {thumbnail && (
        <span className="nav-preview" aria-hidden="true">
          <img src={thumbnail} alt="" />
          <small>{isNext ? "NEXT" : "PREVIOUS"}</small>
        </span>
      )}
    </button>
  );
}

/**
 * Creates a frame thumbnail from the currently loaded video.
 * This is reusable for timeline previews and navigation previews.
 */
function useVideoThumbnail(videoRef, time, enabled) {
  const [thumbnail, setThumbnail] = useState("");

  useEffect(() => {
    if (!enabled || !videoRef.current || !Number.isFinite(time)) {
      return;
    }

    const video = videoRef.current;

    if (!video.videoWidth || !video.videoHeight) {
      return;
    }

    const canvas = document.createElement("canvas");
    const width = 180;
    const height = Math.round((video.videoHeight / video.videoWidth) * width);

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) return;

    const previousTime = video.currentTime;
    const previousPaused = video.paused;

    const drawFrame = () => {
      try {
        context.drawImage(video, 0, 0, width, height);
        setThumbnail(canvas.toDataURL("image/jpeg", 0.72));

        if (!previousPaused) {
          video.play().catch(() => {});
        }
      } catch {
        setThumbnail("");
      }
    };

    const seekedHandler = () => drawFrame();

    video.addEventListener("seeked", seekedHandler, { once: true });

    try {
      video.currentTime = Math.max(
        0,
        Math.min(time, Math.max(0, video.duration - 0.05)),
      );
    } catch {
      video.removeEventListener("seeked", seekedHandler);
    }

    return () => {
      video.removeEventListener("seeked", seekedHandler);
      try {
        video.currentTime = previousTime;
      } catch {
        // Video may have changed before cleanup.
      }
    };
  }, [videoRef, time, enabled]);

  return thumbnail;
}

/**
 * Reusable timeline with hover preview.
 */
function VideoTimeline({
  currentTime,
  duration,
  onSeek,
  videoRef,
}) {
  const timelineRef = useRef(null);
  const [hover, setHover] = useState(null);

  const getTimeFromPointer = useCallback((event) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect || !duration) return 0;

    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / rect.width),
    );

    return ratio * duration;
  }, [duration]);

  const handlePointerMove = useCallback(
    (event) => {
      const time = getTimeFromPointer(event);
      const rect = timelineRef.current?.getBoundingClientRect();

      if (!rect) return;

      setHover({
        time,
        x: event.clientX - rect.left,
      });
    },
    [getTimeFromPointer],
  );

  const hoverThumbnail = useVideoThumbnail(
    videoRef,
    hover?.time ?? 0,
    Boolean(hover),
  );

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="timeline-wrap"
      ref={timelineRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHover(null)}
      onClick={(event) => {
        onSeek(getTimeFromPointer(event));
      }}
      role="slider"
      aria-label="Video progress"
      aria-valuemin={0}
      aria-valuemax={duration || 0}
      aria-valuenow={currentTime}
    >
      <div className="timeline">
        <div
          className="timeline-progress"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
        <div
          className="timeline-dot"
          style={{ left: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>

      {hover && (
        <div
          className="timeline-preview"
          style={{
            left: Math.min(
              Math.max(72, hover.x),
              (timelineRef.current?.clientWidth ?? 200) - 72,
            ),
          }}
        >
          {hoverThumbnail ? (
            <img src={hoverThumbnail} alt="" />
          ) : (
            <div className="thumbnail-loading">PREVIEW</div>
          )}
          <strong>{formatTime(hover.time)}</strong>
        </div>
      )}
    </div>
  );
}

function VolumeControl({ volume, muted, onVolumeChange, onToggleMute }) {
  return (
    <div className="volume-control">
      <button
        type="button"
        className="icon-button"
        onClick={onToggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted || volume === 0 ? "⌁" : "◖"}
      </button>

      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={muted ? 0 : volume}
        onChange={(event) => onVolumeChange(Number(event.target.value))}
        aria-label="Volume"
      />
    </div>
  );
}

function PlaybackSpeed({ speed, onChange }) {
  return (
    <select
      className="speed-select"
      value={speed}
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label="Playback speed"
    >
      {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((value) => (
        <option key={value} value={value}>
          {value}×
        </option>
      ))}
    </select>
  );
}

function Playlist({
  videos,
  currentIndex,
  positions,
  onSelect,
}) {
  return (
    <aside className="playlist">
      <div className="playlist-heading">
        <div>
          <span className="eyebrow">PLAYLIST</span>
          <h2>{videos.length} videos</h2>
        </div>
        <span className="playlist-count">
          {currentIndex + 1}/{videos.length}
        </span>
      </div>

      <div className="playlist-items">
        {videos.map((video, index) => {
          const savedPosition = positions[video.id] ?? 0;

          return (
            <button
              key={video.id}
              type="button"
              className={`playlist-item ${
                index === currentIndex ? "is-active" : ""
              }`}
              onClick={() => onSelect(index)}
            >
              <span className={`playlist-number playlist-number--${video.accent}`}>
                {String(index + 1).padStart(2, "0")}
              </span>

              <span className="playlist-copy">
                <strong>{video.title}</strong>
                <small>
                  {savedPosition > 0
                    ? `Resume ${formatTime(savedPosition)}`
                    : "Not watched"}
                </small>
              </span>

              {index === currentIndex && (
                <span className="playing-indicator">●</span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function App() {
  const videoRef = useRef(null);
  const saveTimerRef = useRef(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [positions, setPositions] = useState(readSavedPositions);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentVideo = VIDEO_LIST[currentIndex];

  const previousVideo = useMemo(
    () =>
      VIDEO_LIST[
        (currentIndex - 1 + VIDEO_LIST.length) % VIDEO_LIST.length
      ],
    [currentIndex],
  );

  const nextVideo = useMemo(
    () => VIDEO_LIST[(currentIndex + 1) % VIDEO_LIST.length],
    [currentIndex],
  );

  const savePosition = useCallback((videoId, time) => {
    setPositions((previous) => {
      const next = {
        ...previous,
        [videoId]: time,
      };

      writeSavedPositions(next);
      return next;
    });
  }, []);

  const startVideo = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      await videoRef.current.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, []);

  const pauseVideo = useCallback(() => {
    videoRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      startVideo();
    } else {
      pauseVideo();
    }
  }, [pauseVideo, startVideo]);

  const changeVideo = useCallback(
    (index, autoplay = true) => {
      const nextIndex =
        (index + VIDEO_LIST.length) % VIDEO_LIST.length;

      savePosition(currentVideo.id, videoRef.current?.currentTime ?? currentTime);

      setCurrentIndex(nextIndex);
      setCurrentTime(positions[VIDEO_LIST[nextIndex].id] ?? 0);
      setIsPlaying(autoplay);
    },
    [currentTime, currentVideo.id, positions, savePosition],
  );

  const handleNext = useCallback(() => {
    changeVideo(currentIndex + 1, true);
  }, [changeVideo, currentIndex]);

  const handlePrevious = useCallback(() => {
    changeVideo(currentIndex - 1, true);
  }, [changeVideo, currentIndex]);

  const seekRelative = useCallback((amount) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = Math.min(
      Math.max(0, video.currentTime + amount),
      video.duration || Number.MAX_SAFE_INTEGER,
    );
  }, []);

  const seekTo = useCallback((time) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(time, duration));
  }, [duration]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setDuration(video.duration || 0);

    const saved = positions[currentVideo.id] ?? 0;

    if (saved > 0 && saved < video.duration - 0.5) {
      video.currentTime = saved;
      setCurrentTime(saved);
    } else {
      setCurrentTime(0);
    }

    video.playbackRate = speed;
    video.volume = volume;
    video.muted = muted;

    if (isPlaying) {
      video.play().catch(() => setIsPlaying(false));
    }
  }, [
    currentVideo.id,
    isPlaying,
    muted,
    positions,
    speed,
    volume,
  ]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setCurrentTime(video.currentTime);

    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      savePosition(currentVideo.id, video.currentTime);
    }, 250);
  }, [currentVideo.id, savePosition]);

  const handleEnded = useCallback(() => {
    savePosition(currentVideo.id, 0);
    handleNext();
  }, [currentVideo.id, handleNext, savePosition]);

  const handleVolumeChange = useCallback((value) => {
    const nextValue = Math.max(0, Math.min(1, value));

    setVolume(nextValue);
    setMuted(nextValue === 0);

    if (videoRef.current) {
      videoRef.current.volume = nextValue;
      videoRef.current.muted = nextValue === 0;
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    const nextMuted = !muted;

    setMuted(nextMuted);

    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
  }, [muted]);

  const handleSpeedChange = useCallback((value) => {
    setSpeed(value);

    if (videoRef.current) {
      videoRef.current.playbackRate = value;
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const player = document.querySelector(".player-shell");

    if (!document.fullscreenElement) {
      await player?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () =>
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange,
      );
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const tag = event.target?.tagName?.toLowerCase();

      if (tag === "input" || tag === "select" || tag === "textarea") {
        return;
      }

      switch (event.key.toLowerCase()) {
        case " ":
        case "k":
          event.preventDefault();
          togglePlay();
          break;
        case "arrowleft":
          event.preventDefault();
          seekRelative(-SEEK_SECONDS);
          break;
        case "arrowright":
          event.preventDefault();
          seekRelative(SEEK_SECONDS);
          break;
        case "m":
          event.preventDefault();
          handleToggleMute();
          break;
        case "f":
          event.preventDefault();
          toggleFullscreen();
          break;
        case "n":
          event.preventDefault();
          handleNext();
          break;
        case "p":
          event.preventDefault();
          handlePrevious();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleNext,
    handlePrevious,
    handleToggleMute,
    seekRelative,
    toggleFullscreen,
    togglePlay,
  ]);

  useEffect(() => {
    return () => window.clearTimeout(saveTimerRef.current);
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">14</span>
          <div>
            <strong>MEDIA//LAB</strong>
            <span>REACT USE REF</span>
          </div>
        </div>

        <div className="topbar-status">
          <span className="status-dot" />
          POSITION SAVED
        </div>
      </header>

      <main className="page">
        <section className="intro">
          <div>
            <p className="eyebrow">REACT PROJECT / VIDEO PLAYER CONTROLS</p>
            <h1>
              Control the
              <br />
              <em>media.</em>
            </h1>
            <p className="intro-copy">
              Practice refs, imperative browser APIs, media events,
              localStorage, reusable components, and interactive previews.
            </p>
          </div>

          <div className="shortcut-card">
            <span>KEYBOARD</span>
            <div><kbd>SPACE</kbd> play</div>
            <div><kbd>←</kbd><kbd>→</kbd> seek 10s</div>
            <div><kbd>N</kbd><kbd>P</kbd> next / previous</div>
            <div><kbd>M</kbd> mute · <kbd>F</kbd> fullscreen</div>
          </div>
        </section>

        <section className="workspace">
          <div className="player-column">
            <div className="player-shell">
              <div className="player-header">
                <div>
                  <span className="eyebrow">NOW PLAYING</span>
                  <h2>{currentVideo.title}</h2>
                </div>
                <span className="video-counter">
                  {String(currentIndex + 1).padStart(2, "0")} /{" "}
                  {String(VIDEO_LIST.length).padStart(2, "0")}
                </span>
              </div>

              <div className="video-stage">
                <video
                  key={currentVideo.id}
                  ref={videoRef}
                  src={currentVideo.src}
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={handleEnded}
                />

                <div className="stage-badge">
                  <span />
                  {isPlaying ? "PLAYING" : "PAUSED"}
                </div>
              </div>

              <div className="controls-panel">
                <VideoTimeline
                  currentTime={currentTime}
                  duration={duration}
                  onSeek={seekTo}
                  videoRef={videoRef}
                />

                <div className="time-row">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>

                <div className="main-controls">
                  <NavigationButton
                    direction="previous"
                    title="Previous"
                    thumbnail={previousVideo.src}
                    onClick={handlePrevious}
                  />

                  <div className="center-controls">
                    <SeekButton
                      direction="backward"
                      onClick={() => seekRelative(-SEEK_SECONDS)}
                    />

                    <PlayButton
                      isPlaying={isPlaying}
                      onClick={togglePlay}
                    />

                    <SeekButton
                      direction="forward"
                      onClick={() => seekRelative(SEEK_SECONDS)}
                    />
                  </div>

                  <NavigationButton
                    direction="next"
                    title="Next"
                    thumbnail={nextVideo.src}
                    onClick={handleNext}
                  />
                </div>

                <div className="secondary-controls">
                  <VolumeControl
                    volume={volume}
                    muted={muted}
                    onVolumeChange={handleVolumeChange}
                    onToggleMute={handleToggleMute}
                  />

                  <PlaybackSpeed
                    speed={speed}
                    onChange={handleSpeedChange}
                  />

                  <button
                    type="button"
                    className="fullscreen-button"
                    onClick={toggleFullscreen}
                  >
                    {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  </button>
                </div>
              </div>
            </div>

            <div className="player-notes">
              <div>
                <span>POSITION</span>
                <strong>
                  {positions[currentVideo.id]
                    ? `Resumes at ${formatTime(positions[currentVideo.id])}`
                    : "No saved position yet"}
                </strong>
              </div>
              <div>
                <span>10 SECOND SEEK</span>
                <strong>Back / Forward</strong>
              </div>
              <div>
                <span>AUTOPLAY</span>
                <strong>Next on end</strong>
              </div>
            </div>
          </div>

          <Playlist
            videos={VIDEO_LIST}
            currentIndex={currentIndex}
            positions={positions}
            onSelect={(index) => changeVideo(index, true)}
          />
        </section>

        <section className="learning-section">
          <div className="section-heading">
            <p className="eyebrow">WHAT YOU ARE PRACTICING</p>
            <h2>Reusable media architecture.</h2>
          </div>

          <div className="learning-grid">
            <article>
              <span>01</span>
              <h3>useRef + video API</h3>
              <p>
                The video DOM node is controlled through a ref for play,
                pause, seeking, volume, rate, and fullscreen workflows.
              </p>
            </article>

            <article>
              <span>02</span>
              <h3>localStorage</h3>
              <p>
                Every video's playback position is persisted independently,
                so switching videos does not destroy your progress.
              </p>
            </article>

            <article>
              <span>03</span>
              <h3>Timeline previews</h3>
              <p>
                Hover over the timeline to calculate a timestamp and capture
                a preview frame from the video with canvas.
              </p>
            </article>

            <article>
              <span>04</span>
              <h3>Component design</h3>
              <p>
                Controls are separated into reusable PlayButton, SeekButton,
                NavigationButton, Timeline, Volume, Speed, and Playlist
                components.
              </p>
            </article>
          </div>
        </section>

        <section className="challenge">
          <div>
            <p className="eyebrow">LEVEL-UP CHALLENGE</p>
            <h2>Turn this into a real streaming UI.</h2>
            <p>
              Add dynamic playlists, poster images, captions, quality
              switching, picture-in-picture, watch history, keyboard focus
              management, and API-driven video metadata.
            </p>
          </div>
        </section>
      </main>

      <footer>
        <span>PROJECT</span>
        <span>useRef • Media API • localStorage • Reusable Components</span>
      </footer>
    </div>
  );
}

export default App;

import React, { useEffect, useRef, useState } from 'react';

export function AudioPlayer(props: {
  title: string;
  url: string;
  autoPlay?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!props.autoPlay) return;
    const a = audioRef.current;
    if (!a) return;
    a.play().catch(() => {
      // Autoplay may be blocked.
    });
  }, [props.autoPlay, props.url]);

  return (
    <div className="w-full">
      <div className="text-sm text-stone-700 mb-2">{props.title}</div>
      <audio
        ref={audioRef}
        src={props.url}
        controls
        className="w-full"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <div className="mt-1 text-xs text-stone-500">{playing ? '播放中…' : '已暂停'}</div>
    </div>
  );
}

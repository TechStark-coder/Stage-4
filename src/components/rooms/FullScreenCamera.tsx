
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Radio, RefreshCw, StopCircle, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import "./FullScreenCamera.css";

interface FullScreenCameraProps {
  onClose: () => void;
  onVideoRecorded: (videoFile: File) => void;
}

export function FullScreenCamera({ onClose, onVideoRecorded }: FullScreenCameraProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = () => {
    setElapsedTime(0);
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(prevTime => prevTime + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setElapsedTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const cleanupCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    stopTimer();
  }, [cameraStream]);

  const setupCamera = useCallback(async (mode: 'user' | 'environment') => {
    cleanupCamera();
    setHasPermission(null);
    setCameraError(null);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: true });
        setCameraStream(stream);
        setHasPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error("Error accessing camera:", err);
        setHasPermission(false);
        let message = `Could not access the ${mode} camera. Please check permissions or try the other camera.`;
        if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
            message = `No ${mode} camera found on this device.`
        } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            message = "Camera access was denied. Please enable permissions in your browser settings.";
        }
        setCameraError(message);
        toast({ title: "Camera Error", description: message, variant: "destructive" });
      }
    } else {
      setCameraError("Camera access is not supported by this browser.");
      setHasPermission(false);
    }
  }, [cleanupCamera, toast]);

  const handleToggleCamera = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    setupCamera(newMode);
  };

  const handleStartRecording = () => {
    if (!cameraStream) return;
    setIsRecording(true);
    startTimer();
    recordedChunksRef.current = [];
    const options = { mimeType: 'video/webm; codecs=vp9' }; 
    mediaRecorderRef.current = new MediaRecorder(cameraStream, options);

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'video/webm' });
      onVideoRecorded(file);
      // onClose will be called by the parent component after receiving the file
    };

    mediaRecorderRef.current.start();
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    stopTimer();
  };

  useEffect(() => {
    setupCamera(facingMode);
    return () => {
      cleanupCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fullscreen-camera-overlay">
      <video ref={videoRef} autoPlay muted playsInline className="fullscreen-camera-video" />

      <div className="fullscreen-camera-controls top">
        {isRecording && <div className="timer">{formatTime(elapsedTime)}</div>}
        <Button variant="ghost" size="icon" onClick={onClose} className="control-button close-button">
          <X className="h-6 w-6" />
        </Button>
      </div>

      <div className="fullscreen-camera-controls bottom">
        <div className="control-placeholder"></div>
        
        {!isRecording ? (
          <Button onClick={handleStartRecording} disabled={!cameraStream || !hasPermission} className="control-button record-button">
            <Radio className="h-8 w-8" />
          </Button>
        ) : (
          <Button onClick={handleStopRecording} variant="destructive" className="control-button record-button">
            <StopCircle className="h-8 w-8" />
          </Button>
        )}
        
        {!isRecording ? (
          <Button variant="ghost" size="icon" onClick={handleToggleCamera} disabled={!hasPermission} className="control-button">
            <RefreshCw className="h-6 w-6" />
          </Button>
        ) : (
           <div className="control-placeholder"></div>
        )}
      </div>
      
      {hasPermission === false && cameraError && (
        <div className="camera-error-container">
          <Alert variant="destructive">
            <AlertTitle>Camera Access Error</AlertTitle>
            <AlertDescription>{cameraError}</AlertDescription>
          </Alert>
        </div>
      )}
      
      {hasPermission === null && !cameraError && (
        <div className="camera-loading-container">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Requesting camera access...</p>
        </div>
      )}
    </div>
  );
}

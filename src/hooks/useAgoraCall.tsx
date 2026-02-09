import { useState, useEffect, useCallback, useRef } from 'react';
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng';
import { supabase } from '@/integrations/supabase/client';

// ============= AGORA LOGGING UTILITY =============
const agoraLog = {
  info: (context: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    console.log(`[${timestamp}][Agora][${context}] ${message}`, data !== undefined ? data : '');
  },
  warn: (context: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    console.warn(`[${timestamp}][Agora][${context}] ⚠️ ${message}`, data !== undefined ? data : '');
  },
  error: (context: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    console.error(`[${timestamp}][Agora][${context}] ❌ ${message}`, data !== undefined ? data : '');
  },
  success: (context: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    console.log(`[${timestamp}][Agora][${context}] ✅ ${message}`, data !== undefined ? data : '');
  },
  debug: (context: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    console.debug(`[${timestamp}][Agora][${context}] 🔍 ${message}`, data !== undefined ? data : '');
  },
};

// Generate stable numeric UID from user ID string
const generateUidFromUserId = (userId: string): number => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 1000000000; // Agora UID range: 0 to 10^9
};

interface UseAgoraCallProps {
  channelName: string;
  uid?: number;
  enabled: boolean;
  isVideoCall: boolean;
}

interface AgoraCallState {
  localVideoTrack: ICameraVideoTrack | null;
  localAudioTrack: IMicrophoneAudioTrack | null;
  remoteUsers: IAgoraRTCRemoteUser[];
  isJoined: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isConnecting: boolean;
  error: string | null;
}

export const useAgoraCall = ({ channelName, uid, enabled, isVideoCall }: UseAgoraCallProps) => {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const joinInProgressRef = useRef(false);
  const hasJoinedRef = useRef(false);
  const eventListenersSetRef = useRef(false);
  const lastUserInfoUpdateRef = useRef<Map<string, number>>(new Map());
  const isMountedRef = useRef(true);
  const isClientReadyRef = useRef(false);
  const retryCountRef = useRef(0);
  
  const [state, setState] = useState<AgoraCallState>({
    localVideoTrack: null,
    localAudioTrack: null,
    remoteUsers: [],
    isJoined: false,
    isMuted: false,
    isVideoOff: false,
    isConnecting: false,
    error: null,
  });

  const safeSetState = useCallback((updater: React.SetStateAction<AgoraCallState>) => {
    if (isMountedRef.current) {
      setState(updater);
    }
  }, []);

  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Create new Agora client for each call session
  useEffect(() => {
    if (enabled && channelName) {
      isClientReadyRef.current = false;
      
      if (clientRef.current) {
        agoraLog.info('Init', 'Cleaning up old client before creating new one', { channel: channelName });
        clientRef.current.removeAllListeners();
        clientRef.current = null;
      }
      
      hasJoinedRef.current = false;
      joinInProgressRef.current = false;
      eventListenersSetRef.current = false;
      retryCountRef.current = 0;
      
      const sdkVersion = AgoraRTC.VERSION;
      clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      
      isClientReadyRef.current = true;
      
      agoraLog.success('Init', 'New client created and ready', { 
        channel: channelName, 
        sdkVersion,
        mode: 'rtc', 
        codec: 'vp8',
        isVideoCall 
      });
    }
    
    return () => {
      isClientReadyRef.current = false;
      if (clientRef.current) {
        agoraLog.info('Init', 'Cleanup: removing client listeners');
        clientRef.current.removeAllListeners();
        clientRef.current = null;
      }
    };
  }, [enabled, channelName, isVideoCall]);

  const setupEventListeners = useCallback(() => {
    if (!clientRef.current) {
      agoraLog.warn('Events', 'Cannot setup listeners: no client');
      return;
    }
    
    clientRef.current.removeAllListeners();
    eventListenersSetRef.current = true;
    agoraLog.info('Events', 'Setting up event listeners');
    
    clientRef.current.on('user-published', async (user, mediaType) => {
      agoraLog.info('Events', 'User published', { uid: user.uid, mediaType, hasAudio: user.hasAudio, hasVideo: user.hasVideo });
      try {
        if (!clientRef.current) return;
        const subscribeStart = Date.now();
        await clientRef.current.subscribe(user, mediaType);
        agoraLog.success('Events', 'Subscribed to user', { uid: user.uid, mediaType, time: `${Date.now() - subscribeStart}ms` });
        
        safeSetState(prev => {
          const existingUser = prev.remoteUsers.find(u => u.uid === user.uid);
          
          if (existingUser) {
            const hasNewVideo = mediaType === 'video' && !existingUser.videoTrack && user.videoTrack;
            const hasNewAudio = mediaType === 'audio' && !existingUser.audioTrack && user.audioTrack;
            
            if (!hasNewVideo && !hasNewAudio) {
              agoraLog.debug('Events', 'No actual track change, skipping state update', { uid: user.uid });
              return prev;
            }
          }
          
          const existingIndex = prev.remoteUsers.findIndex(u => u.uid === user.uid);
          let newRemoteUsers: IAgoraRTCRemoteUser[];
          
          if (existingIndex >= 0) {
            newRemoteUsers = [...prev.remoteUsers];
            newRemoteUsers[existingIndex] = user;
          } else {
            newRemoteUsers = [...prev.remoteUsers, user];
          }
          
          agoraLog.debug('Events', 'Updated remoteUsers', { 
            count: newRemoteUsers.length, 
            users: newRemoteUsers.map(u => ({ uid: u.uid, hasVideo: !!u.videoTrack, hasAudio: !!u.audioTrack }))
          });
          return { ...prev, remoteUsers: newRemoteUsers };
        });
        
        if (mediaType === 'audio' && user.audioTrack) {
          agoraLog.info('Events', 'Auto-playing remote audio', { uid: user.uid });
          user.audioTrack.play();
        }
      } catch (err: any) {
        agoraLog.error('Events', 'Failed to subscribe', { uid: user.uid, mediaType, error: err?.message || err });
      }
    });

    clientRef.current.on('user-unpublished', (user, mediaType) => {
      agoraLog.info('Events', 'User unpublished', { uid: user.uid, mediaType });
      safeSetState(prev => ({
        ...prev,
        remoteUsers: prev.remoteUsers.map(u => u.uid === user.uid ? user : u),
      }));
    });

    clientRef.current.on('user-left', (user, reason) => {
      agoraLog.info('Events', 'User left', { uid: user.uid, reason });
      safeSetState(prev => ({
        ...prev,
        remoteUsers: prev.remoteUsers.filter(u => u.uid !== user.uid),
      }));
    });

    clientRef.current.on('user-joined', (user) => {
      agoraLog.info('Events', 'User joined channel', { uid: user.uid });
    });

    clientRef.current.on('connection-state-change', (curState, prevState, reason) => {
      agoraLog.info('Connection', 'State changed', { from: prevState, to: curState, reason });
    });

    clientRef.current.on('exception', (event) => {
      agoraLog.error('Exception', 'Agora exception occurred', { code: event.code, msg: event.msg, uid: event.uid });
    });

    clientRef.current.on('network-quality', (stats) => {
      if (stats.uplinkNetworkQuality <= 2 || stats.downlinkNetworkQuality <= 2) {
        agoraLog.warn('Network', 'Poor network quality detected', {
          uplink: stats.uplinkNetworkQuality,
          downlink: stats.downlinkNetworkQuality
        });
      }
    });

    clientRef.current.on('token-privilege-will-expire', () => {
      agoraLog.warn('Token', 'Token will expire soon - need to renew');
    });

    clientRef.current.on('token-privilege-did-expire', () => {
      agoraLog.error('Token', 'Token has expired - call will disconnect');
    });

    clientRef.current.on('user-info-updated', (uid, msg) => {
      const now = Date.now();
      const key = `${uid}-${msg}`;
      const lastUpdate = lastUserInfoUpdateRef.current.get(key) || 0;
      
      if (now - lastUpdate < 1000) {
        return;
      }
      
      lastUserInfoUpdateRef.current.set(key, now);
      agoraLog.debug('Events', 'User info updated', { uid, msg });
    });

    agoraLog.success('Events', 'All event listeners configured');
  }, [safeSetState]);

  // Fetch token from Supabase Edge Function
  const fetchToken = useCallback(async (retries = 3): Promise<{ token: string; appId: string; uid: number }> => {
    let lastError: Error | null = null;
    const fetchStartTime = Date.now();
    
    agoraLog.info('Token', 'Starting token fetch via Edge Function', { channel: channelName, retries });
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || !session?.user?.id) {
      agoraLog.error('Token', 'No valid session found - user must login');
      throw new Error('Bạn cần đăng nhập để thực hiện cuộc gọi');
    }
    
    const stableUid = generateUidFromUserId(session.user.id);
    agoraLog.debug('Token', 'Generated stable UID', { uid: stableUid, userId: session.user.id.substring(0, 8) + '...' });
    
    for (let attempt = 0; attempt < retries; attempt++) {
      const attemptStart = Date.now();
      try {
        agoraLog.info('Token', `Fetch attempt ${attempt + 1}/${retries}`, { channel: channelName, uid: stableUid });

        const { data, error } = await supabase.functions.invoke('agora-token', {
          body: { channel: channelName, uid: stableUid, role: 'publisher' },
        });

        if (error) {
          agoraLog.error('Token', 'Edge function error', { error: error.message });
          throw new Error(error.message || 'Không thể lấy token từ server');
        }

        agoraLog.success('Token', 'Token fetched successfully', {
          appId: data.appId?.substring(0, 8) + '...',
          tokenLength: data.token?.length,
          tokenPrefix: data.token?.substring(0, 20) + '...',
          uid: stableUid,
          totalTime: `${Date.now() - fetchStartTime}ms`
        });
        
        return { ...data, uid: stableUid };
      } catch (error: any) {
        agoraLog.error('Token', `Attempt ${attempt + 1} failed`, { 
          error: error.message, 
          time: `${Date.now() - attemptStart}ms` 
        });
        lastError = error;
        
        if (error.message?.includes('đăng nhập')) {
          throw error;
        }
        
        if (attempt < retries - 1) {
          const waitTime = 1000 * (attempt + 1);
          agoraLog.info('Token', `Waiting ${waitTime}ms before retry...`);
          await new Promise(r => setTimeout(r, waitTime));
        }
      }
    }
    
    agoraLog.error('Token', 'All retry attempts exhausted', { totalTime: `${Date.now() - fetchStartTime}ms` });
    throw lastError || new Error('Không thể lấy token sau nhiều lần thử');
  }, [channelName]);

  const waitForClientReady = useCallback(async (timeoutMs: number = 3000): Promise<boolean> => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (isClientReadyRef.current && clientRef.current) {
        return true;
      }
      await new Promise(r => setTimeout(r, 50));
    }
    
    agoraLog.error('Join', 'Client not ready within timeout', { timeoutMs });
    return false;
  }, []);

  const joinChannel = useCallback(async () => {
    const joinStartTime = Date.now();
    
    if (!isClientReadyRef.current || !clientRef.current) {
      agoraLog.warn('Join', 'Client not ready, waiting...', { isReady: isClientReadyRef.current, hasClient: !!clientRef.current });
      
      const isReady = await waitForClientReady(3000);
      if (!isReady) {
        safeSetState(prev => ({ ...prev, isConnecting: false, error: 'Không thể khởi tạo kết nối. Vui lòng thử lại.' }));
        return;
      }
    }
    
    if (!clientRef.current || !channelName) {
      agoraLog.warn('Join', 'Cannot join: missing client or channelName', { hasClient: !!clientRef.current, channelName });
      return;
    }
    
    if (joinInProgressRef.current) {
      agoraLog.warn('Join', 'Join already in progress, skipping');
      return;
    }
    
    if (hasJoinedRef.current) {
      agoraLog.warn('Join', 'Already joined, skipping');
      return;
    }

    const connectionState = clientRef.current.connectionState;
    agoraLog.info('Join', 'Current connection state', { state: connectionState });
    
    if (connectionState === 'CONNECTED' || connectionState === 'CONNECTING') {
      agoraLog.warn('Join', 'Client still connected, cleaning up first', { state: connectionState });
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
      }
      try {
        await clientRef.current.leave();
        agoraLog.info('Join', 'Cleanup leave completed');
      } catch (e: any) {
        agoraLog.warn('Join', 'Cleanup leave error (ignored)', { error: e?.message });
      }
      hasJoinedRef.current = false;
      eventListenersSetRef.current = false;
      clientRef.current.removeAllListeners();
      await new Promise(r => setTimeout(r, 500));
    }

    joinInProgressRef.current = true;
    safeSetState(prev => ({ ...prev, isConnecting: true, error: null }));
    agoraLog.info('Join', '=== Starting join process ===', { channel: channelName, isVideoCall, retryCount: retryCountRef.current });

    try {
      setupEventListeners();
      
      const { token, appId, uid: tokenUid } = await fetchToken();
      
      agoraLog.info('Join', 'Joining channel with credentials', { 
        channel: channelName, 
        appId: appId?.substring(0, 8) + '...', 
        uid: tokenUid,
        tokenLength: token?.length
      });
      
      const joinApiStart = Date.now();
      await clientRef.current.join(appId, channelName, token, tokenUid);
      
      await new Promise(r => setTimeout(r, 100));
      
      if (clientRef.current.connectionState !== 'CONNECTED') {
        agoraLog.warn('Join', 'Not connected after join API, waiting...', { state: clientRef.current.connectionState });
        await new Promise(r => setTimeout(r, 500));
      }
      
      hasJoinedRef.current = true;
      retryCountRef.current = 0;
      agoraLog.success('Join', 'Joined channel', { time: `${Date.now() - joinApiStart}ms`, state: clientRef.current.connectionState });

      // Create and publish audio track
      agoraLog.info('Tracks', 'Creating microphone audio track...');
      const audioTrackStart = Date.now();
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: 'speech_standard',
      });
      localAudioTrackRef.current = audioTrack;
      agoraLog.success('Tracks', 'Audio track created', { time: `${Date.now() - audioTrackStart}ms` });

      // Create video track if video call
      let videoTrack: ICameraVideoTrack | null = null;
      if (isVideoCall) {
        agoraLog.info('Tracks', 'Creating camera video track...');
        const videoTrackStart = Date.now();
        videoTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: '720p_2',
        });
        localVideoTrackRef.current = videoTrack;
        agoraLog.success('Tracks', 'Video track created', { time: `${Date.now() - videoTrackStart}ms` });
      }

      // Publish tracks
      const tracksToPublish = videoTrack ? [audioTrack, videoTrack] : [audioTrack];
      agoraLog.info('Publish', 'Publishing tracks...', { trackCount: tracksToPublish.length });
      const publishStart = Date.now();
      
      try {
        await clientRef.current.publish(tracksToPublish);
        agoraLog.success('Publish', 'Tracks published', { time: `${Date.now() - publishStart}ms` });
      } catch (publishError: any) {
        if (publishError.code === 'INVALID_OPERATION' && retryCountRef.current < 2) {
          agoraLog.warn('Publish', 'INVALID_OPERATION on publish, will retry after delay', { retryCount: retryCountRef.current });
          retryCountRef.current++;
          
          audioTrack.stop();
          audioTrack.close();
          if (videoTrack) {
            videoTrack.stop();
            videoTrack.close();
          }
          localAudioTrackRef.current = null;
          localVideoTrackRef.current = null;
          
          try {
            await clientRef.current.leave();
          } catch (e) {}
          
          hasJoinedRef.current = false;
          joinInProgressRef.current = false;
          
          setTimeout(() => {
            joinChannel();
          }, 1000);
          return;
        }
        throw publishError;
      }

      safeSetState(prev => ({
        ...prev,
        localAudioTrack: audioTrack,
        localVideoTrack: videoTrack,
        isJoined: true,
        isConnecting: false,
      }));

      agoraLog.success('Join', '=== Join process completed ===', { 
        totalTime: `${Date.now() - joinStartTime}ms`,
        hasAudio: true,
        hasVideo: !!videoTrack
      });

    } catch (error: any) {
      agoraLog.error('Join', 'Join failed', { 
        error: error.message, 
        code: error.code,
        totalTime: `${Date.now() - joinStartTime}ms` 
      });
      
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
      }
      
      safeSetState(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message || 'Không thể kết nối cuộc gọi',
      }));
    } finally {
      joinInProgressRef.current = false;
    }
  }, [channelName, isVideoCall, fetchToken, setupEventListeners, waitForClientReady, safeSetState]);

  const leaveChannel = useCallback(async () => {
    agoraLog.info('Leave', '=== Starting leave process ===');
    const leaveStartTime = Date.now();
    
    joinInProgressRef.current = false;
    hasJoinedRef.current = false;
    
    if (localAudioTrackRef.current) {
      agoraLog.info('Leave', 'Stopping and closing audio track');
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current.close();
      localAudioTrackRef.current = null;
    }
    if (localVideoTrackRef.current) {
      agoraLog.info('Leave', 'Stopping and closing video track');
      localVideoTrackRef.current.stop();
      localVideoTrackRef.current.close();
      localVideoTrackRef.current = null;
    }
    
    if (clientRef.current) {
      try {
        if (clientRef.current.connectionState !== 'DISCONNECTED') {
          agoraLog.info('Leave', 'Leaving channel...', { state: clientRef.current.connectionState });
          await clientRef.current.leave();
          agoraLog.success('Leave', 'Left channel');
        }
      } catch (error: any) {
        agoraLog.warn('Leave', 'Error leaving channel (ignored)', { error: error.message });
      }
      clientRef.current.removeAllListeners();
      eventListenersSetRef.current = false;
    }
    
    safeSetState({
      localVideoTrack: null,
      localAudioTrack: null,
      remoteUsers: [],
      isJoined: false,
      isMuted: false,
      isVideoOff: false,
      isConnecting: false,
      error: null,
    });
    
    agoraLog.success('Leave', '=== Leave process completed ===', { totalTime: `${Date.now() - leaveStartTime}ms` });
  }, [safeSetState]);

  const toggleMute = useCallback(async () => {
    if (localAudioTrackRef.current) {
      const newMuteState = !state.isMuted;
      agoraLog.info('Mute', 'Toggling mute', { from: state.isMuted, to: newMuteState });
      await localAudioTrackRef.current.setEnabled(!newMuteState);
      safeSetState(prev => ({ ...prev, isMuted: newMuteState }));
    }
  }, [state.isMuted, safeSetState]);

  const toggleVideo = useCallback(async () => {
    if (localVideoTrackRef.current) {
      const newVideoOffState = !state.isVideoOff;
      agoraLog.info('Video', 'Toggling video', { from: state.isVideoOff, to: newVideoOffState });
      await localVideoTrackRef.current.setEnabled(!newVideoOffState);
      safeSetState(prev => ({ ...prev, isVideoOff: newVideoOffState }));
    }
  }, [state.isVideoOff, safeSetState]);

  // Auto-join when enabled
  useEffect(() => {
    if (enabled && channelName && isClientReadyRef.current && !hasJoinedRef.current && !joinInProgressRef.current) {
      const timer = setTimeout(() => {
        if (enabled && channelName && !hasJoinedRef.current && !joinInProgressRef.current) {
          agoraLog.info('AutoJoin', 'Triggering auto-join', { channel: channelName });
          joinChannel();
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [enabled, channelName, joinChannel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      agoraLog.info('Cleanup', 'Component unmounting, cleaning up...');
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
      }
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current.close();
      }
      if (clientRef.current) {
        clientRef.current.removeAllListeners();
        if (clientRef.current.connectionState !== 'DISCONNECTED') {
          clientRef.current.leave().catch(() => {});
        }
      }
    };
  }, []);

  return {
    ...state,
    joinChannel,
    leaveChannel,
    toggleMute,
    toggleVideo,
    localVideoRef,
    client: clientRef.current,
  };
};

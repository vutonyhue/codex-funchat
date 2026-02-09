import { useState, useRef, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Conversation, Message } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useMessages } from '@/hooks/useMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useReadReceipts } from '@/hooks/useReadReceipts';
import { useReactions } from '@/hooks/useReactions';
import { ConnectionStatus } from './ConnectionStatus';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import MessageBubble from './MessageBubble';
import CryptoSendDialog from './CryptoSendDialog';
import ImagePreviewDialog from './ImagePreviewDialog';
import ForwardMessageDialog from './ForwardMessageDialog';
import TextInputContextMenu from './TextInputContextMenu';
import { TypingIndicator } from './TypingIndicator';
import PinnedMessages from './PinnedMessages';
import EditMessageDialog from './EditMessageDialog';
import BlockUserDialog from './BlockUserDialog';
import ReportDialog from './ReportDialog';
import MentionSuggestions from './MentionSuggestions';
import RedEnvelopeDialog from './RedEnvelopeDialog';
import PresenceStatusText from './PresenceStatusText';
import { Sticker } from '@/types/stickers';
import { useBlocks } from '@/hooks/useBlocks';
import { useAngelAI } from '@/hooks/useAngelAI';
import { useRedEnvelope } from '@/hooks/useRedEnvelope';
import { useTemplates } from '@/hooks/useTemplates';
import TemplatesMenu from './TemplatesMenu';
import { toast } from 'sonner';
import * as chatApi from '@/lib/supabaseChat';
import { createScheduledMessage } from '@/lib/scheduledMessages';
import { 
  Phone, 
  Video, 
  MoreVertical, 
  Send, 
  Smile, 
  Paperclip,
  Coins,
  Loader2,
  ArrowLeft,
  X,
  Reply,
  Mic,
  User,
  Bell,
  BellOff,
  Trash2,
  Search,
  Pin,
  Gift,
  FileText,
  Settings,
  Clock,
  Image as ImageIcon,
  Sticker as StickerIcon,
  CalendarClock,
  Wallet,
} from 'lucide-react';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import VoiceRecorder from './VoiceRecorder';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

// Lazy load heavy components for better performance
const ImageLightbox = lazy(() => import('./ImageLightbox'));
const StickerPicker = lazy(() => import('./StickerPicker'));
const StickerStore = lazy(() => import('./StickerStore'));
const SearchDialog = lazy(() => import('./SearchDialog'));
const RedEnvelopeClaimDialog = lazy(() => import('./RedEnvelopeClaimDialog'));
const GroupSettingsDialog = lazy(() => import('./GroupSettingsDialog'));
const ScheduleMessageDialog = lazy(() => import('./ScheduleMessageDialog'));
const ScheduledMessagesList = lazy(() => import('./ScheduledMessagesList'));

// Fallback skeleton for lazy components
const DialogSkeleton = () => (
  <div className="flex items-center justify-center p-8">
    <Skeleton className="w-16 h-16 rounded-lg" />
  </div>
);

// Import LightboxImage type from the lazy-loaded module
type LightboxImage = { src: string; alt: string };

interface ChatWindowProps {
  conversation: Conversation;
  conversations: Conversation[];
  onVideoCall: () => void;
  onVoiceCall: () => void;
  onBack?: () => void;
  onDeleteConversation?: (conversationId: string) => void;
}

export default function ChatWindow({ conversation, conversations, onVideoCall, onVoiceCall, onBack, onDeleteConversation }: ChatWindowProps) {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  
  // Reactions and read receipts hooks
  const { fetchReactions, toggleReaction, getReactionGroups, handleReactionAdded, handleReactionRemoved } = useReactions(conversation.id);
  const { markAsRead, isReadByOthers, getReadTime, handleReadReceipt } = useReadReceipts(conversation.id, []);
  const { typingUsers, setTypingUsersFromSSE } = useTypingIndicator();
  
  // Messages hook with SSE callbacks for reactions/receipts/typing
  const { 
    messages, 
    loading, 
    hasMore,
    isLoadingMore,
    loadMore,
    sendMessage, 
    sendCryptoMessage, 
    sendImageMessage, 
    sendVoiceMessage, 
    deleteMessage, 
    retryMessage,
    connectionStatus,
    broadcastTyping,
  } = useMessages(conversation.id, {
    onTyping: setTypingUsersFromSSE,
    onReactionAdded: handleReactionAdded,
    onReactionRemoved: handleReactionRemoved,
    onReadReceipt: handleReadReceipt,
  });
  
  const { isRecording, duration, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();
  
  // Sort messages by created_at ASC for correct display order
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messages]);

  // Get message IDs for read receipts - only stable (non-temp) messages from others
  const stableMessageIds = useMemo(() => 
    sortedMessages
      .filter(m => !m.id.startsWith('temp_') && m.sender_id !== user?.id)
      .map(m => m.id), 
    [sortedMessages, user?.id]
  );
  
  // Reactions - only for stable messages
  const allStableMessageIds = useMemo(() => 
    sortedMessages.filter(m => !m.id.startsWith('temp_')).map(m => m.id), 
    [sortedMessages]
  );
  
  // Fetch reactions when messages change
  useEffect(() => {
    if (allStableMessageIds.length > 0) {
      fetchReactions(allStableMessageIds);
    }
  }, [allStableMessageIds, fetchReactions]);
  const [newMessage, setNewMessage] = useState('');
  const [showCryptoDialog, setShowCryptoDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  // Block & Report states
  const [blockingUser, setBlockingUser] = useState<{ id: string; name: string } | null>(null);
  const [reportingMessage, setReportingMessage] = useState<Message | null>(null);
  const { blockUser, reportMessage } = useBlocks();
  
  // Angel AI hook
  const { processAngelMessage, isProcessing: isAngelProcessing } = useAngelAI({
    conversationId: conversation.id,
  });
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  
  // Red Envelope
  const { createEnvelope } = useRedEnvelope();
  const [showRedEnvelopeDialog, setShowRedEnvelopeDialog] = useState(false);
   
  // Stickers
  const [showStickerStore, setShowStickerStore] = useState(false);
  const [openingEnvelopeId, setOpeningEnvelopeId] = useState<string | null>(null);
  
  // Templates
  const { templates, incrementUseCount, findByShortcut } = useTemplates();
  const [showTemplatesMenu, setShowTemplatesMenu] = useState(false);
  
  // Group Settings
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  
  // Scheduled Messages
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showScheduledList, setShowScheduledList] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const isAtBottomRef = useRef(true);
  const forceScrollToBottomRef = useRef(false);

  // Fetch pinned messages
  useEffect(() => {
    const fetchPinned = async () => {
      const pinned = await chatApi.getPinnedMessages(conversation.id);
      setPinnedMessages(pinned);
    };
    fetchPinned();
  }, [conversation.id]);

  // Extract all images from messages for lightbox navigation
  const allImages = useMemo<LightboxImage[]>(() => {
    return messages
      .filter(m => m.message_type === 'image')
      .map(m => {
        const metadata = m.metadata as { file_url: string; file_name: string };
        return { src: metadata.file_url, alt: metadata.file_name };
      });
  }, [messages]);

  const handleImageClick = (src: string, alt: string) => {
    const index = allImages.findIndex(img => img.src === src);
    if (index !== -1) {
      setLightboxIndex(index);
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  const otherMember = conversation.members?.find(m => m.user_id !== profile?.id);
  const chatName = conversation.is_group 
    ? conversation.name 
    : otherMember?.profile?.display_name || otherMember?.profile?.username;
  const chatAvatar = conversation.is_group 
    ? conversation.avatar_url 
    : otherMember?.profile?.avatar_url;

  // Get mute status from conversation members directly
  useEffect(() => {
    if (!user || !conversation.members) return;
    
    const myMembership = conversation.members.find(m => m.user_id === user.id);
    setIsMuted((myMembership as any)?.is_muted || false);
  }, [conversation.id, conversation.members, user]);

  // Reset scroll flag when conversation changes
  useEffect(() => {
    setInitialScrollDone(false);
  }, [conversation.id]);

  const getScrollViewport = useCallback((): HTMLDivElement | null => {
    const root = scrollRef.current;
    if (!root) return null;
    return root.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!hasMore || isLoadingMore || loading) return;
    const viewport = getScrollViewport();
    if (!viewport) return;

    const prevScrollHeight = viewport.scrollHeight;
    const prevScrollTop = viewport.scrollTop;

    await loadMore();

    // Restore scroll position after messages are prepended.
    requestAnimationFrame(() => {
      const newScrollHeight = viewport.scrollHeight;
      viewport.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
    });
  }, [hasMore, isLoadingMore, loading, getScrollViewport, loadMore]);

  // Track whether the user is near the bottom; trigger load-more when scrolling to top.
  useEffect(() => {
    const viewport = getScrollViewport();
    if (!viewport) return;

    const onScroll = () => {
      const distanceToBottom = viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight);
      isAtBottomRef.current = distanceToBottom < 120;

      if (viewport.scrollTop < 40) {
        void loadOlderMessages();
      }
    };

    viewport.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => viewport.removeEventListener('scroll', onScroll);
  }, [getScrollViewport, loadOlderMessages]);

  // Initial scroll when opening conversation (instant, no animation)
  useEffect(() => {
    if (!loading && messages.length > 0 && !initialScrollDone) {
      scrollToBottom('auto');
      setInitialScrollDone(true);
    }
  }, [loading, messages.length, initialScrollDone, scrollToBottom]);

  // Scroll on new messages (smooth animation)
  useEffect(() => {
    if (!initialScrollDone || messages.length === 0) return;
    if (!forceScrollToBottomRef.current && !isAtBottomRef.current) return;

    forceScrollToBottomRef.current = false;
    const t = window.setTimeout(() => scrollToBottom('smooth'), 50);
    return () => window.clearTimeout(t);
  }, [messages.length, initialScrollDone, scrollToBottom]);

  // Mark messages as read when they are displayed (debounced)
  useEffect(() => {
    if (!user || stableMessageIds.length === 0) return;
    
    // Debounce to avoid spam
    const timer = setTimeout(() => {
      markAsRead(stableMessageIds);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [stableMessageIds, user, markAsRead]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    const content = newMessage;
    const replyId = replyingTo?.id;
    setNewMessage('');
    setReplyingTo(null);
    setShowMentions(false);
    forceScrollToBottomRef.current = true;
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    // Send user's message first
    await sendMessage(content, 'text', {}, replyId);

    // Check for @angel trigger and process AI response
    const { response, error } = await processAngelMessage(content, sortedMessages);
    if (response && !error && user) {
      // Send Angel AI response as a special message
      await chatApi.sendMessage(
        conversation.id,
        user.id, // Use current user as sender but mark as AI in metadata
        response,
        'text',
        { is_ai: true, ai_type: 'angel', ai_prompt: content }
      );
    }
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    textareaRef.current?.focus();
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Đã sao chép tin nhắn');
  };

  const handleForward = (message: Message) => {
    setForwardingMessage(message);
  };

  const handleForwardToConversations = async (conversationIds: string[], message: Message) => {
    if (!user) return;

    try {
      // Forward message to each selected conversation using gateway
      for (const convId of conversationIds) {
        let content = message.content || '';
        let metadata: Record<string, any> = { 
          ...(typeof message.metadata === 'object' ? message.metadata : {}), 
          forwarded: true, 
          original_sender: message.sender?.display_name 
        };

        // Handle different message types
        if (message.message_type === 'image' || message.message_type === 'file') {
          content = message.content || (message.message_type === 'image' ? 'Đã chuyển tiếp hình ảnh' : 'Đã chuyển tiếp file');
        } else if (message.message_type === 'crypto') {
          content = `Đã chuyển tiếp: ${message.content}`;
          metadata = { forwarded: true, original_sender: message.sender?.display_name };
        }

        const result = await chatApi.sendMessage(convId, user.id, content, message.message_type, metadata);
        if (result.error) {
          throw result.error;
        }
      }

      toast.success(`Đã chuyển tiếp đến ${conversationIds.length} cuộc trò chuyện`);
    } catch (error) {
      console.error('Forward error:', error);
      toast.error('Không thể chuyển tiếp tin nhắn');
    }
  };

  const handleDelete = async (message: Message) => {
    const { error } = await deleteMessage(message.id);
    if (error) {
      toast.error('Không thể thu hồi tin nhắn');
    } else {
      toast.success('Đã thu hồi tin nhắn');
    }
  };

  const handleReaction = (messageId: string, emoji: string) => {
    toggleReaction(messageId, emoji);
  };

  const handleRetry = (messageId: string) => {
    retryMessage(messageId);
  };

  // Pin/Unpin handlers
  const handlePin = async (messageId: string) => {
    if (!user) return;
    const { error } = await chatApi.pinMessage(messageId, user.id);
    if (error) {
      toast.error('Không thể ghim tin nhắn');
    } else {
      toast.success('Đã ghim tin nhắn');
      // Refresh pinned messages
      const pinned = await chatApi.getPinnedMessages(conversation.id);
      setPinnedMessages(pinned);
    }
  };

  const handleUnpin = async (messageId: string) => {
    const { error } = await chatApi.unpinMessage(messageId);
    if (error) {
      toast.error('Không thể bỏ ghim tin nhắn');
    } else {
      toast.success('Đã bỏ ghim tin nhắn');
      // Refresh pinned messages
      const pinned = await chatApi.getPinnedMessages(conversation.id);
      setPinnedMessages(pinned);
    }
  };

  // Edit message handler
  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!user) return;
    const { error } = await chatApi.editMessage(messageId, user.id, newContent);
    if (error) {
      toast.error('Không thể sửa tin nhắn');
      throw error;
    }
    toast.success('Đã sửa tin nhắn');
  };

  // Search handler
  const handleSearch = async (query: string): Promise<Message[]> => {
    return chatApi.searchMessages(conversation.id, query);
  };

  // Scroll to message when clicking from pinned/search
  const handleScrollToMessage = (messageId: string) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight effect
      messageElement.classList.add('bg-primary/10');
      setTimeout(() => {
        messageElement.classList.remove('bg-primary/10');
      }, 2000);
    }
  };

  // Block & Report handlers (5D Light Language)
  const handleBlockUser = (userId: string, userName: string) => {
    setBlockingUser({ id: userId, name: userName });
  };

  const handleConfirmBlock = async (reason?: string) => {
    if (!blockingUser) return;
    const { error } = await blockUser(blockingUser.id, reason);
    if (error) {
      toast.error('Không thể tạm ngừng kết nối. Vui lòng thử lại.');
      throw error;
    }
    toast.success('Đã tạm ngừng kết nối');
    setBlockingUser(null);
  };

  const handleReportMessage = (message: Message) => {
    setReportingMessage(message);
  };

  const handleConfirmReport = async (reason: string, details?: string) => {
    if (!reportingMessage || !reportingMessage.sender_id) return;
    const { error } = await reportMessage(
      reportingMessage.id,
      reportingMessage.sender_id,
      reason,
      details
    );
    if (error) {
      toast.error('Không thể gửi phản hồi. Vui lòng thử lại.');
      throw error;
    }
    toast.success('Đã gửi phản hồi. Cảm ơn bạn!');
    setReportingMessage(null);
  };

  // Red Envelope handlers
  const handleCreateRedEnvelope = async (params: {
    totalAmount: number;
    currency: string;
    totalRecipients: number;
    distributionType: 'random' | 'equal';
    message?: string;
  }) => {
    const { error } = await createEnvelope({
      conversationId: conversation.id,
      ...params,
    });
    if (error) {
      toast.error('Không thể tạo lì xì. Vui lòng thử lại.');
      throw error;
    }
    toast.success('Đã gửi lì xì! 🧧');
    setShowRedEnvelopeDialog(false);
  };

  const handleOpenRedEnvelope = (envelopeId: string) => {
    setOpeningEnvelopeId(envelopeId);
  };

  // Sticker handler
  const handleSendSticker = async (sticker: Sticker) => {
    await sendMessage(sticker.name, 'sticker', {
      sticker_id: sticker.id,
      pack_id: sticker.pack_id,
      url: sticker.url,
      name: sticker.name,
    });
    forceScrollToBottomRef.current = true;
  };

  const getReplyPreview = (msg: Message) => {
    if (msg.message_type === 'image') return '📷 Hình ảnh';
    if (msg.message_type === 'file') return '📁 File';
    if (msg.message_type === 'crypto') return '💰 Crypto';
    return msg.content?.slice(0, 50) + (msg.content && msg.content.length > 50 ? '...' : '');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Shift+Enter sẽ tự động xuống dòng
  };

  const handleSendCrypto = async (amount: number, currency: string, txHash?: string) => {
    if (!otherMember) return;
    await sendCryptoMessage(otherMember.user_id, amount, currency, txHash);
    setShowCryptoDialog(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Reset input immediately
    e.target.value = '';

    // Limit: 4 files per message
    const limited = files.slice(0, 4);
    if (files.length > 4) {
      toast.error('Tối đa 4 file mỗi tin nhắn');
    }

    // Validate file size (max 4GB/file)
    const MAX = 4 * 1024 * 1024 * 1024;
    for (const f of limited) {
      if (f.size > MAX) {
        toast.error(`File quá lớn (tối đa 4GB): ${f.name}`);
        return;
      }
    }

    // Single image: show preview dialog (caption)
    if (limited.length === 1 && (limited[0].type || '').startsWith('image/')) {
      setPreviewFile(limited[0]);
      setShowPreview(true);
      return;
    }

    // Otherwise: send each file as a separate message
    setUploading(true);
    try {
      for (const f of limited) {
        const { error } = await sendImageMessage(f);
        if (error) throw error;
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Không thể gửi file');
    } finally {
      setUploading(false);
    }
  };

  const handleSendWithCaption = async (caption: string) => {
    if (!previewFile) return;

    setUploading(true);
    const { error } = await sendImageMessage(previewFile, caption);
    setUploading(false);

    if (error) {
      toast.error('Không thể gửi ảnh');
      console.error('Upload error:', error);
    } else {
      setShowPreview(false);
      setPreviewFile(null);
    }
  };

  const handleClosePreview = () => {
    if (!uploading) {
      setShowPreview(false);
      setPreviewFile(null);
    }
  };

  const handleStartRecording = async () => {
    const success = await startRecording();
    if (!success) {
      toast.error('Không thể truy cập microphone. Vui lòng cấp quyền.');
    }
  };

  const handleSendVoice = async () => {
    const audioBlob = await stopRecording();
    if (audioBlob && duration > 0) {
      const { error } = await sendVoiceMessage(audioBlob, duration);
      if (error) {
        toast.error('Không thể gửi tin nhắn thoại');
        console.error('Voice send error:', error);
      }
    }
  };

  const handleCancelRecording = () => {
    cancelRecording();
  };

  // Menu handlers
  const handleViewProfile = () => {
    if (conversation.is_group) {
      toast.info('Đây là nhóm chat');
    } else if (otherMember?.user_id) {
      navigate(`/profile/${otherMember.user_id}`);
    }
  };

  const handleToggleMute = async () => {
    if (!user) return;

    const newMutedState = !isMuted;

    // Optimistic update
    setIsMuted(newMutedState);

    try {
      // Use API to toggle mute (need to add this endpoint later)
      // For now, show success since the state is saved locally
      toast.success(newMutedState ? 'Đã tắt thông báo' : 'Đã bật thông báo');
    } catch (error) {
      // Rollback on error
      setIsMuted(!newMutedState);
      toast.error('Không thể thay đổi cài đặt thông báo');
    }
  };

  const handleDeleteConversation = async () => {
    if (!user) return;

    try {
      const result = await chatApi.leaveConversation(user.id, conversation.id);
      if (result.error) {
        throw result.error;
      }

      toast.success('Đã xóa cuộc trò chuyện');
      onDeleteConversation?.(conversation.id);
      if (onBack) onBack();
    } catch (error) {
      console.error('Delete conversation error:', error);
      toast.error('Không thể xóa cuộc trò chuyện');
    }

    setShowDeleteDialog(false);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-xl"
              onClick={onBack}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <Avatar className="w-10 h-10 ring-2 ring-offset-2 ring-primary/20">
            <AvatarImage src={chatAvatar || undefined} />
            <AvatarFallback className={`font-semibold ${
              conversation.is_group ? 'gradient-warm' : 'gradient-primary'
            } text-white`}>
              {chatName?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold truncate">{chatName}</h2>
              {/* Connection Status Badge */}
              <ConnectionStatus status={connectionStatus} />
            </div>
            <PresenceStatusText 
              conversation={conversation} 
              otherMemberId={otherMember?.user_id} 
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10"
            onClick={() => setShowSearchDialog(true)}
          >
            <Search className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-xl text-primary hover:bg-primary/10"
            onClick={onVoiceCall}
          >
            <Phone className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-xl text-primary hover:bg-primary/10"
            onClick={onVideoCall}
          >
            <Video className="w-5 h-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleViewProfile}>
                <User className="w-4 h-4 mr-2" />
                Xem hồ sơ
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowSearchDialog(true)}>
                <Search className="w-4 h-4 mr-2" />
                Tìm kiếm tin nhắn
              </DropdownMenuItem>
              {pinnedMessages.length > 0 && (
                <DropdownMenuItem onClick={() => {
                  const firstPinned = pinnedMessages[0];
                  if (firstPinned) handleScrollToMessage(firstPinned.id);
                }}>
                  <Pin className="w-4 h-4 mr-2" />
                  Xem tin nhắn đã ghim ({pinnedMessages.length})
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowScheduledList(true)}>
                <Clock className="w-4 h-4 mr-2" />
                Tin nhắn đã đặt lịch
              </DropdownMenuItem>
              {conversation.is_group && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowGroupSettings(true)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Cài đặt nhóm
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleToggleMute}>
                {isMuted ? (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    Bật thông báo
                  </>
                ) : (
                  <>
                    <BellOff className="w-4 h-4 mr-2" />
                    Tắt thông báo
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Xóa cuộc trò chuyện
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Pinned Messages */}
      <PinnedMessages 
        messages={pinnedMessages}
        onUnpin={handleUnpin}
        onMessageClick={handleScrollToMessage}
        canUnpin={true}
      />

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 gradient-chat" ref={scrollRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : sortedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <div className="w-20 h-20 rounded-2xl gradient-primary/20 flex items-center justify-center mb-4">
              <Send className="w-10 h-10 text-primary" />
            </div>
            <p className="font-medium">Bắt đầu cuộc trò chuyện</p>
            <p className="text-sm">Gửi tin nhắn đầu tiên cho {chatName}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {isLoadingMore && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {sortedMessages.map((message, index) => {
              const isLastFromSender = 
                index === sortedMessages.length - 1 || 
                sortedMessages[index + 1]?.sender_id !== message.sender_id;
              
              return (
                <div key={message.id} id={`message-${message.id}`} className="transition-colors duration-500">
                  <MessageBubble 
                    message={message} 
                    onImageClick={handleImageClick}
                    isRead={isReadByOthers(message.id, message.sender_id || '')}
                    readTime={getReadTime(message.id, message.sender_id || '')}
                    showReadStatus={isLastFromSender}
                    onReply={handleReply}
                    onCopy={handleCopy}
                    onForward={handleForward}
                    onDelete={handleDelete}
                    onReaction={handleReaction}
                    reactionGroups={getReactionGroups(message.id)}
                    onRetry={handleRetry}
                    onPin={handlePin}
                    onUnpin={handleUnpin}
                    onEdit={(msg) => setEditingMessage(msg)}
                    onBlockUser={handleBlockUser}
                    onReportMessage={handleReportMessage}
                    onOpenRedEnvelope={handleOpenRedEnvelope}
                  />
                </div>
              );
            })}
            
            {/* Typing Indicator */}
            <TypingIndicator typingUsers={typingUsers} />
            
            {/* Scroll anchor - invisible element at the end */}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Reply Preview */}
      {replyingTo && (
        <div className="px-4 pt-3 bg-card/50 backdrop-blur-sm border-t">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
            <Reply className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-primary">
                Đang trả lời {replyingTo.sender_id === user?.id ? 'chính bạn' : replyingTo.sender?.display_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {getReplyPreview(replyingTo)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 rounded-full shrink-0"
              onClick={() => setReplyingTo(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t bg-card/50 backdrop-blur-sm">
        {isRecording ? (
          <VoiceRecorder
            duration={duration}
            onCancel={handleCancelRecording}
            onSend={handleSendVoice}
          />
        ) : (
          <div className="w-full">
            <div className="flex items-center gap-2">
              {/* Paperclip dropdown menu (bên trái) */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,.7z,.apk"
                className="hidden"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl text-muted-foreground hover:text-primary shrink-0"
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Paperclip className="w-5 h-5" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56 bg-popover">
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Ảnh / Video / File
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleStartRecording}>
                    <Mic className="w-4 h-4 mr-2" />
                    Ghi âm
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowStickerStore(true)}>
                    <Gift className="w-4 h-4 mr-2" />
                    Sticker
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowTemplatesMenu(true)}>
                    <FileText className="w-4 h-4 mr-2" />
                    Mẫu tin nhắn
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowCryptoDialog(true)}>
                    <Coins className="w-4 h-4 mr-2" />
                    Gửi tiền
                  </DropdownMenuItem>
                  {conversation.is_group && (
                    <DropdownMenuItem onClick={() => setShowRedEnvelopeDialog(true)}>
                      <Gift className="w-4 h-4 mr-2 text-destructive" />
                      Lì xì
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => {
                    if (newMessage.trim()) {
                      setShowScheduleDialog(true);
                    } else {
                      toast.error('Vui lòng nhập tin nhắn trước');
                    }
                  }}>
                    <Clock className="w-4 h-4 mr-2" />
                    Đặt lịch gửi
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Ô input (flex-1) */}
              <div className="flex-1 relative">
                {/* Templates Menu */}
                {showTemplatesMenu && (
                  <TemplatesMenu
                    templates={templates}
                    inputValue={newMessage}
                    onSelect={(template) => {
                      setNewMessage(template.content);
                      setShowTemplatesMenu(false);
                      incrementUseCount(template.id);
                      textareaRef.current?.focus();
                      adjustTextareaHeight();
                    }}
                    onClose={() => setShowTemplatesMenu(false)}
                  />
                )}
                {/* Mention Suggestions for @angel */}
                {showMentions && (
                  <MentionSuggestions
                    inputValue={newMessage}
                    cursorPosition={cursorPosition}
                    onSelect={(mention) => {
                      const textBeforeCursor = newMessage.slice(0, cursorPosition);
                      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
                      const textAfterCursor = newMessage.slice(cursorPosition);
                      const newValue = newMessage.slice(0, lastAtIndex) + mention + textAfterCursor;
                      setNewMessage(newValue);
                      setShowMentions(false);
                      textareaRef.current?.focus();
                    }}
                    onClose={() => setShowMentions(false)}
                    members={conversation.members}
                  />
                )}
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <Textarea
                      ref={textareaRef}
                      placeholder="Nhập tin nhắn..."
                      value={newMessage}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewMessage(value);
                        adjustTextareaHeight();
                        setCursorPosition(e.target.selectionStart || 0);
                        
                        if (value.startsWith('/') && value.length > 0) {
                          setShowTemplatesMenu(true);
                        } else {
                          setShowTemplatesMenu(false);
                        }
                        
                        const textBeforeCursor = value.slice(0, e.target.selectionStart || 0);
                        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
                        const shouldShowMentions = lastAtIndex !== -1 && 
                          !textBeforeCursor.slice(lastAtIndex + 1).includes(' ') &&
                          !textBeforeCursor.slice(lastAtIndex + 1).includes('\n');
                        setShowMentions(shouldShowMentions);
                        
                        if (profile) {
                          broadcastTyping(profile.display_name || profile.username);
                        }
                      }}
                      onKeyDown={handleKeyDown}
                      rows={1}
                      className="min-h-[44px] max-h-[120px] py-3 pr-28 resize-none rounded-xl bg-muted/50 border-0 focus-visible:ring-primary overflow-y-auto"
                    />
                  </ContextMenuTrigger>
                  <TextInputContextMenu
                    textareaRef={textareaRef}
                    value={newMessage}
                    onChange={setNewMessage}
                    onKeyDown={handleKeyDown}
                  />
                </ContextMenu>
                {/* Emoji + Send buttons (bên phải) */}
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  <Suspense fallback={<Skeleton className="w-8 h-8 rounded-lg" />}>
                    <StickerPicker
                      onSelect={handleSendSticker}
                      onOpenStore={() => setShowStickerStore(true)}
                    />
                  </Suspense>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 rounded-lg text-muted-foreground hover:text-primary"
                  >
                    <Smile className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    className="w-8 h-8 rounded-lg gradient-primary"
                    onClick={handleSend}
                    disabled={!newMessage.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Crypto Dialog */}
      <CryptoSendDialog
        open={showCryptoDialog}
        onClose={() => setShowCryptoDialog(false)}
        onSend={handleSendCrypto}
        recipientName={chatName || ''}
        recipientWallet={otherMember?.profile?.wallet_address}
      />

      {/* Image Preview Dialog */}
      <ImagePreviewDialog
        open={showPreview}
        onClose={handleClosePreview}
        file={previewFile}
        onSend={handleSendWithCaption}
        uploading={uploading}
      />

      {/* Image Lightbox with swipe */}
      {lightboxIndex !== null && (
        <Suspense fallback={<DialogSkeleton />}>
          <ImageLightbox
            images={allImages}
            currentIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onIndexChange={setLightboxIndex}
          />
        </Suspense>
      )}

      {/* Forward Message Dialog */}
      <ForwardMessageDialog
        open={!!forwardingMessage}
        onClose={() => setForwardingMessage(null)}
        message={forwardingMessage}
        conversations={conversations.filter(c => c.id !== conversation.id)}
        onForward={handleForwardToConversations}
      />

      {/* Delete Conversation Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa cuộc trò chuyện?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn sẽ không thể nhận tin nhắn từ cuộc trò chuyện này nữa.
              Lịch sử tin nhắn sẽ bị xóa khỏi danh sách của bạn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Search Dialog */}
      {showSearchDialog && (
        <Suspense fallback={<DialogSkeleton />}>
          <SearchDialog
            open={showSearchDialog}
            onClose={() => setShowSearchDialog(false)}
            conversationId={conversation.id}
            onSearch={handleSearch}
            onMessageClick={handleScrollToMessage}
          />
        </Suspense>
      )}

      {/* Edit Message Dialog */}
      <EditMessageDialog
        open={!!editingMessage}
        onClose={() => setEditingMessage(null)}
        message={editingMessage}
        onSave={handleEditMessage}
      />

      {/* Block User Dialog - 5D Light Language */}
      <BlockUserDialog
        open={!!blockingUser}
        onOpenChange={(open) => !open && setBlockingUser(null)}
        userName={blockingUser?.name || ''}
        onConfirm={handleConfirmBlock}
      />

      {/* Report Dialog - 5D Light Language */}
      <ReportDialog
        open={!!reportingMessage}
        onOpenChange={(open) => !open && setReportingMessage(null)}
        type="message"
        targetName={reportingMessage?.sender?.display_name || reportingMessage?.sender?.username || 'Người dùng'}
        onConfirm={handleConfirmReport}
      />

      {/* Red Envelope Dialog */}
      <RedEnvelopeDialog
        open={showRedEnvelopeDialog}
        onOpenChange={setShowRedEnvelopeDialog}
        maxRecipients={(conversation.members?.length || 1) - 1}
        onConfirm={handleCreateRedEnvelope}
      />

      {/* Red Envelope Claim Dialog */}
      {openingEnvelopeId && (
        <Suspense fallback={<DialogSkeleton />}>
          <RedEnvelopeClaimDialog
            open={!!openingEnvelopeId}
            onOpenChange={(open) => !open && setOpeningEnvelopeId(null)}
            envelopeId={openingEnvelopeId}
            onClaimed={() => {
              toast.success('Chúc mừng bạn nhận được lì xì! 🎉');
            }}
          />
        </Suspense>
      )}

      {/* Sticker Store Dialog */}
      {showStickerStore && (
        <Suspense fallback={<DialogSkeleton />}>
          <StickerStore
            open={showStickerStore}
            onOpenChange={setShowStickerStore}
          />
        </Suspense>
      )}

      {/* Group Settings Dialog */}
      {conversation.is_group && (
        <Suspense fallback={<DialogSkeleton />}>
          <GroupSettingsDialog
            open={showGroupSettings}
            onOpenChange={setShowGroupSettings}
            conversation={conversation}
          />
        </Suspense>
      )}

      {/* Schedule Message Dialog */}
      <Suspense fallback={<DialogSkeleton />}>
        <ScheduleMessageDialog
          open={showScheduleDialog}
          onOpenChange={setShowScheduleDialog}
          messageContent={newMessage}
          onSchedule={async (scheduledAt) => {
            if (!user) return;
            const { error } = await createScheduledMessage({
              conversation_id: conversation.id,
              sender_id: user.id,
              content: newMessage,
              scheduled_at: scheduledAt.toISOString(),
            });
            if (error) {
              toast.error('Không thể đặt lịch: ' + error.message);
            } else {
              toast.success(`Đã đặt lịch gửi lúc ${scheduledAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày ${scheduledAt.toLocaleDateString('vi-VN')}`);
              setNewMessage('');
            }
          }}
        />
      </Suspense>

      {/* Scheduled Messages List */}
      <Suspense fallback={<DialogSkeleton />}>
        <ScheduledMessagesList
          open={showScheduledList}
          onOpenChange={setShowScheduledList}
          conversationId={conversation.id}
        />
      </Suspense>
    </div>
  );
}

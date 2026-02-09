import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { joinByInviteLink } from '@/lib/groupAdmin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function JoinGroup() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [joining, setJoining] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // If not logged in, redirect to auth with return URL
    if (!authLoading && !user) {
      navigate(`/auth?redirect=/join/${inviteCode}`);
    }
  }, [authLoading, user, navigate, inviteCode]);

  const handleJoin = async () => {
    if (!user || !inviteCode) return;

    setJoining(true);
    const { data, error } = await joinByInviteLink(inviteCode, user.id);

    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      toast.error(error.message);
    } else if (data) {
      setStatus('success');
      toast.success(`Đã tham gia nhóm "${data.name}"!`);
      
      // Navigate to the chat after a short delay
      setTimeout(() => {
        navigate(`/chat?conversation=${data.id}`);
      }, 1500);
    }
    setJoining(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-white" />
          </div>
          <CardTitle>Tham gia nhóm chat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === 'idle' && (
            <>
              <p className="text-center text-muted-foreground">
                Bạn đã được mời tham gia một nhóm chat. Nhấn nút bên dưới để tham gia.
              </p>
              <Button
                onClick={handleJoin}
                disabled={joining}
                className="w-full"
                size="lg"
              >
                {joining ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang tham gia...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    Tham gia nhóm
                  </>
                )}
              </Button>
            </>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
              <p className="text-primary font-medium">
                Tham gia thành công!
              </p>
              <p className="text-sm text-muted-foreground">
                Đang chuyển đến nhóm chat...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <p className="text-destructive font-medium">
                Không thể tham gia
              </p>
              <p className="text-sm text-muted-foreground">
                {errorMessage}
              </p>
              <Button
                variant="outline"
                onClick={() => navigate('/chat')}
                className="w-full"
              >
                Về trang Chat
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

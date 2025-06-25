
import { redirect } from 'next/navigation';
import { getShortLink } from '@/lib/firestore';
import { AlertTriangle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ShortLinkPageProps {
  params: {
    shortCode: string;
  };
}

export default async function ShortLinkPage({ params }: ShortLinkPageProps) {
  const { shortCode } = params;

  if (!shortCode) {
    // This case should not be hit due to route structure, but for safety
    return (
         <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Invalid Link</h1>
            <p className="text-muted-foreground">The link you used is incomplete.</p>
            <Button asChild variant="outline" className="mt-6">
                <Link href="/">
                    <Home className="mr-2 h-4 w-4" /> Go to Homepage
                </Link>
            </Button>
         </div>
    );
  }

  const longUrl = await getShortLink(shortCode);

  if (longUrl) {
    redirect(longUrl);
  } else {
    return (
         <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Link Not Found</h1>
            <p className="text-muted-foreground">The short link you used does not exist or has expired.</p>
            <Button asChild variant="outline" className="mt-6">
                <Link href="/">
                    <Home className="mr-2 h-4 w-4" /> Go to Homepage
                </Link>
            </Button>
         </div>
    );
  }
}

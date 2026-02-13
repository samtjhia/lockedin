import { verifySecretCode } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function GatePage(props: {
  searchParams: Promise<{ error?: string }>
}) {
  const searchParams = await props.searchParams
  const error = searchParams.error

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4">
      <Card className="w-full max-w-sm border-border bg-card">
        <CardHeader className="space-y-1.5">
          <CardTitle className="text-xl font-semibold text-foreground">
            Sign in
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Enter your username and security code to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 border border-border rounded-md">
              {error}
            </div>
          )}
          <form action={verifySecretCode} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-foreground">
                Username
              </label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Choose a username"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
                required
                minLength={3}
                maxLength={20}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium text-foreground">
                Security code
              </label>
              <Input
                id="code"
                name="code"
                type="password"
                placeholder="Enter security code"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

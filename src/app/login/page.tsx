import { login, signup, signInWithGoogle } from './actions'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default async function LoginPage(props: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const searchParams = await props.searchParams
  const error = searchParams.error
  const message = searchParams.message

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-zinc-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Locked In Factory</CardTitle>
          <CardDescription className="text-center">Swipe your badge to enter the floor.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-100 dark:bg-red-900/30 rounded-md">
                {error}
              </div>
            )}
            {message && (
              <div className="p-3 text-sm text-green-500 bg-green-100 dark:bg-green-900/30 rounded-md">
                {message}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="worker@factory.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <div className="flex flex-col gap-3 pt-4">
                <Button formAction={login} className="w-full">Sign In</Button>
                <Button formAction={signup} variant="outline" className="w-full">New Worker Registration</Button>
                
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                <Button formAction={signInWithGoogle} variant="secondary" className="w-full" formNoValidate>
                  <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                    <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                  </svg>
                  Google
                </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-xs text-muted-foreground">
           By entering you agree to the factory rules.
        </CardFooter>
      </Card>
    </div>
  )
}

import { verifySecretCode } from './actions'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function GatePage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4">
      <Card className="w-full max-w-sm border-border bg-card text-foreground">
        <CardHeader>
          <CardTitle className="text-xl text-center text-red-500 font-mono tracking-widest">RESTRICTED AREA</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Enter the factory security code to proceed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={verifySecretCode} className="space-y-4">
            <div className="space-y-2">
              <Input 
                name="username" 
                type="text" 
                placeholder="CHOOSE CALLSIGN (USERNAME)"
                className="bg-background border-border text-center font-mono text-sm tracking-widest focus:ring-red-900 placeholder:text-muted-foreground" 
                required
                minLength={3}
                maxLength={20}
              />
              <Input 
                name="code" 
                type="password" 
                placeholder="ENTER SECURITY CODE"
                className="bg-background border-border text-center font-mono text-lg tracking-widest focus:ring-red-900" 
                required
              />
            </div>
            <Button type="submit" variant="destructive" className="w-full font-bold tracking-wider">
              VERIFY & ENTER
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

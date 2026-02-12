import { verifySecretCode } from './actions'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function GatePage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-zinc-50 p-4">
      <Card className="w-full max-w-sm border-zinc-800 bg-zinc-900 text-zinc-50">
        <CardHeader>
          <CardTitle className="text-xl text-center text-red-500 font-mono tracking-widest">RESTRICTED AREA</CardTitle>
          <CardDescription className="text-center text-zinc-400">
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
                className="bg-black border-zinc-700 text-center font-mono text-sm tracking-widest focus:ring-red-900 placeholder:text-zinc-600" 
                required
                minLength={3}
                maxLength={20}
              />
              <Input 
                name="code" 
                type="password" 
                placeholder="ENTER SECURITY CODE"
                className="bg-black border-zinc-700 text-center font-mono text-lg tracking-widest focus:ring-red-900" 
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

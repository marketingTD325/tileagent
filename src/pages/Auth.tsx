import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import tegeldepotLogo from '@/assets/tegeldepot-logo.png';
import { useToast } from '@/hooks/use-toast';
import { Search, TrendingUp, FileText, Users } from 'lucide-react';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Fout', description: 'Vul alle velden in', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      toast({ 
        title: 'Inloggen mislukt', 
        description: error.message === 'Invalid login credentials' 
          ? 'Ongeldige inloggegevens' 
          : error.message, 
        variant: 'destructive' 
      });
    } else {
      navigate('/');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Fout', description: 'Vul alle velden in', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Fout', description: 'Wachtwoord moet minimaal 6 karakters zijn', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(email, password, fullName);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({ title: 'Account bestaat al', description: 'Dit e-mailadres is al geregistreerd. Probeer in te loggen.', variant: 'destructive' });
      } else {
        toast({ title: 'Registratie mislukt', description: error.message, variant: 'destructive' });
      }
    } else {
      toast({ title: 'Account aangemaakt!', description: 'Je bent nu ingelogd.' });
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-dark text-white p-12 flex-col justify-between">
        <div>
          <img 
            src={tegeldepotLogo} 
            alt="Tegel & Sanitair Depot" 
            className="h-16 w-auto"
          />
          <p className="text-white/70 mt-3 text-lg">SEO Agent</p>
        </div>
        
        <div className="space-y-8">
          <h2 className="text-4xl font-bold leading-tight">
            AI-gestuurde SEO<br />
            voor jouw <span className="text-gradient">marketing team</span>
          </h2>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Content Generatie</h3>
                <p className="text-sm text-white/60">SEO-geoptimaliseerde teksten in het Nederlands</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">SEO Audits</h3>
                <p className="text-sm text-white/60">Analyseer elke pagina op verbeterpunten</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-accent/20">
                <TrendingUp className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold">Keyword Research</h3>
                <p className="text-sm text-white/60">Vind zoekwoorden voor de Nederlandse markt</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-accent/20">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold">Team Samenwerking</h3>
                <p className="text-sm text-white/60">Werk samen met je marketing team</p>
              </div>
            </div>
          </div>
        </div>
        
        <p className="text-sm text-white/40">
          © 2024 SEO Agent voor Tegeldepot.nl
        </p>
      </div>
      
      {/* Right side - Auth form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardHeader className="text-center">
            <div className="lg:hidden flex justify-center mb-4">
              <img 
                src={tegeldepotLogo} 
                alt="Tegel & Sanitair Depot" 
                className="h-12 w-auto"
              />
            </div>
            <CardTitle className="text-2xl">Welkom</CardTitle>
            <CardDescription>Log in of maak een account aan om verder te gaan</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Inloggen</TabsTrigger>
                <TabsTrigger value="register">Registreren</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">E-mailadres</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="naam@bedrijf.nl"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Wachtwoord</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Bezig...' : 'Inloggen'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Volledige naam</Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Jan de Vries"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">E-mailadres</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="naam@bedrijf.nl"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Wachtwoord</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Minimaal 6 karakters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Bezig...' : 'Account aanmaken'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

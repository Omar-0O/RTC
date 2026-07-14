import React from "react";
import { ThemeProvider } from "./components/theme-provider";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Languages, Sun, Moon, Laptop, AlertTriangle, ArrowRight } from "lucide-react";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

function RedirectPage() {
  const targetUrl = "https://resalartc.online";
  const { t, isRTL, language, setLanguage } = useLanguage();
  const { setTheme } = useTheme();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md space-y-6">
        {/* Logo & Application Title */}
        <div className="text-center">
          <img
            src={logo}
            alt="RTC Mohandseen Logo"
            className="h-48 w-auto mx-auto mb-1 object-contain"
          />
          <h1 className="text-lg font-bold">RTC Mohandseen</h1>
        </div>

        {/* Card Component matching application style */}
        <Card className="border border-border/80 shadow-md">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl font-bold">
              {isRTL ? 'تم انتقال التطبيق إلى موقعنا الجديد' : 'The Application Has Moved to a New Site'}
            </CardTitle>
            <CardDescription className="text-sm mt-2 leading-relaxed">
              {isRTL 
                ? 'تم نقل منصة RTC Mohandseen بالكامل إلى خوادم جديدة لتحسين الأداء والاستقرار. يرجى استخدام وتثبيت الرابط الجديد كبديل دائم.' 
                : 'The RTC Mohandseen platform has been fully migrated to new servers for optimized performance and stability. Please use and bookmark the new link as your permanent access point.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            
            {/* Warning Banner advising users to bookmark/install as app */}
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg p-3 text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">
                  {isRTL ? 'تنبيه هام جداً جداً:' : 'Extremely Important Notice:'}
                </p>
                <p className="leading-relaxed">
                  {isRTL 
                    ? 'يرجى حفظ وتثبيت الرابط الجديد لديكم (عن طريق إضافته للمفضلة Bookmark أو تثبيته كتطبيق على الهاتف/الجهاز)، حيث سيتم إيقاف هذا الرابط القديم الحالي نهائياً خلال أيام.' 
                    : 'Please save the new link (by bookmarking it or installing it as an app on your phone/device). This current old link will be deactivated and stop working in a few days.'}
                </p>
              </div>
            </div>

            {/* Interactive Go Button */}
            <Button asChild className="w-full py-6 text-base font-semibold group cursor-pointer">
              <a href={targetUrl} className="flex items-center justify-center gap-2">
                <span>{isRTL ? 'انتقل إلى الموقع الجديد الآن' : 'Go to the New Site Now'}</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-[-4px] rtl:group-hover:translate-x-[4px]" />
              </a>
            </Button>

            {/* Plain Link */}
            <div className="text-center pt-1">
              <a
                href={targetUrl}
                className="text-xs text-muted-foreground hover:text-primary transition-colors duration-200 underline underline-offset-4 font-mono"
              >
                {targetUrl}
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Floating Theme and Language Controls identical to Auth page */}
      <div className="fixed bottom-4 right-4 flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-white/50 backdrop-blur-sm hover:bg-white/80 text-black hover:text-black shadow-sm border border-gray-100 dark:bg-black/50 dark:hover:bg-black/80 dark:text-white dark:hover:text-white dark:border-gray-800"
              title={t('theme.toggle')}
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
              {t('theme.light')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
              {t('theme.dark')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Laptop className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
              {t('theme.system')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-white/50 backdrop-blur-sm hover:bg-white/80 text-black hover:text-black shadow-sm border border-gray-100 dark:bg-black/50 dark:hover:bg-black/80 dark:text-white dark:hover:text-white dark:border-gray-800"
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          title={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
        >
          <Languages className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <RedirectPage />
      </ThemeProvider>
    </LanguageProvider>
  );
}

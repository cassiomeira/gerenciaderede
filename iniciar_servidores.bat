@echo off
echo ================================================
echo  INICIANDO SERVIDORES - AUTO RESTART ATIVADO
echo ================================================

REM Inicia o Backend Node.js em loop (reinicia se cair)
start "Backend (Node)" cmd /k "echo [BACKEND] Iniciando... && :restart & cd /d c:\aplicativos\gerenciaderede1\gerenciaderede\gerenciaderede\gerenciaderede\network-monitor\backend && npm run dev || (echo [BACKEND] Caiu! Reiniciando em 3s... && timeout /t 3 && goto restart)"

REM Inicia o Frontend Vite
start "Frontend (Vite)" cmd /k "echo [FRONTEND] Iniciando... && cd /d c:\aplicativos\gerenciaderede1\gerenciaderede\gerenciaderede\gerenciaderede\network-monitor\frontend && npm run dev"

echo.
echo Ambos os servidores foram iniciados em janelas separadas!
echo Pode fechar esta janela.
pause

# E-mails da Charrette — como configurar

Modelos em português, com a identidade da Charrette, para os e-mails automáticos do login.

## 1. Colar os modelos no Supabase
Supabase → projeto **charrette** → **Authentication → Emails** (ou "Email Templates").
Para cada aba, troque o **Subject** e cole o conteúdo do arquivo HTML no campo **Message body**:

| Aba no Supabase | Assunto (Subject) | Arquivo |
|---|---|---|
| Confirm signup | Confirme seu cadastro na Charrette | 1-confirmar-cadastro.html |
| Reset password | Crie uma nova senha na Charrette | 2-redefinir-senha.html |
| Invite user | Você foi convidado para a Charrette | 3-convite.html |
| Change email address | Confirme o seu novo e-mail na Charrette | 4-alterar-email.html |
| Magic link | Seu link de acesso à Charrette | 5-link-de-acesso.html |

Os textos entre chaves duplas (como `{{ .ConfirmationURL }}`) são preenchidos pelo Supabase. Não apague.

## 2. Ligar o Resend ao Supabase (depois que o domínio estiver verificado)
Supabase → **Project Settings → Authentication → SMTP Settings** → ativar **Enable custom SMTP**:

- Sender email: nao-responda@SEU-DOMINIO (ex.: nao-responda@charrette.takedadesign.com.br)
- Sender name: Charrette
- Host: smtp.resend.com
- Port: 465
- Username: resend
- Password: a chave de API do Resend (criada só depois que o domínio for verificado)

Depois disso, os e-mails chegam para qualquer pessoa, não só para a equipe do projeto.

import asyncio
import sys
import random
import string
import time
import json
from typing import Optional, List
import aiomysql
from datetime import datetime
#isso aqui é plenamente inutil, pode ser trocado pelo aiomysql, porem tá aq pra caso o corno do professor pedir
#import mysql.Connector
#from mysql.connector import Error
#ignorar linha 10 a 12
## Configs 
APP_TOKEN: Optional[str] = None
APP_PASSWORD:"1r0nW4tch54"
EXPIRA_EM: float = 0.0
TOKEN_TTL = 5 * 60  # 5 minutos
REQUEST_LOG: List[str] = []
HOST = "0.0.0.0"
ADMIN_PORT = 9999
USER_PORT = 5500
#ELA, NELA = thainá
db_pool_admin: Optional[aiomysql.Pool] = None
db_pool_user: Optional[aiomysql.Pool] = None
connected_admin = set()
connected_user = set()
#-----------------------------------------------------------------------------------------------------------------------------------------
#------ Validação de identidade admin
#-----------------------------------------------------------------------------------------------------------------------------------------
async def validar_senha(senha: str, ip: str) -> bool:
    if senha != APP_PASSWORD:
        device_id = await get_device_id_by_ip(ip)
        if device_id:
            await log_admin_action("Senha Invalida", device_id)
        return False
    return True
#-----------------------------------------------------------------------------------------------------------------------------------------
#------ PAREAMENTO
#-----------------------------------------------------------------------------------------------------------------------------------------
def gerar_codigo_pareamento() -> str:
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    return ''.join(random.choice(chars) for _ in range(6))

async def gerar_token():
    global APP_TOKEN, EXPIRA_EM
    APP_TOKEN = gerar_codigo_pareamento()
    EXPIRA_EM = time.time() + TOKEN_TTL
    await init_dbadmin()
    async with db_pool_admin.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "INSERT INTO codigos (code, created_at) VALUES (%s, %s)",
                (APP_TOKEN, datetime.now())
            )
            await conn.commit()
    print(f"[TOKEN] Novo token: {APP_TOKEN} (expira em {time.strftime('%H:%M:%S', time.localtime(EXPIRA_EM))})")

async def validar_token(token: str, ip: str) -> bool:
    if token != APP_TOKEN:
        device_id = await get_device_id_by_ip(ip)
        if device_id:
            await log_admin_action("Token inválido", device_id)
        return False
    return True

#-----------------------------------------------------------------------------------------------------------------------------------------
#------ BANCOS DE DADOS
#-----------------------------------------------------------------------------------------------------------------------------------------
async def init_dbadmin():
    global db_pool_admin
    try:
        db_pool_admin = await aiomysql.create_pool(
            host='localhost', user='root', password='', db='ironwatchadmin',
            minsize=1, maxsize=10
        )
        print("[MYSQL ADMIN] Conectado ao Banco de Dados")
    except Exception as e:
        print(f"[ERRO FATAL] Falha ao conectar ao banco ADMIN: {e}")
        input("Pressione qualquer tecla para encerrar...")
        sys.exit(1)

async def init_dbuser():
    global db_pool_user
    try:
        db_pool_user = await aiomysql.create_pool(
            host='localhost', user='root', password='', db='ironwatch',
            minsize=1, maxsize=10
        )
        print("[MYSQL USER] Conectado ao Banco de Dados")
    except Exception as e:
        print(f"[ERRO FATAL] Falha ao conectar ao banco USER: {e}")
        input("Pressione qualquer tecla para encerrar...")
        sys.exit(1)

#-----------------------------------------------------------------------------------------------------------------------------------------
#------ LOGICA DO ADMIN
#-----------------------------------------------------------------------------------------------------------------------------------------
# ----------------- ADMIN LOGGER ------------------------------
async def get_device_id_by_ip(ip: str) -> int | None:
    async with db_pool_user.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT id FROM Dispositivos WHERE ip=%s", (ip,))
            row = await cur.fetchone()
            if row:
                return row[0]  # id do dispositivo
            return None

async def log_admin_action(motivo: str, device_id: int):
    async with db_pool_admin.acquire() as conn:
        async with conn.cursor() as cur:
            # Opcional: checar se device existe
            await cur.execute("SELECT id FROM Dispositivos WHERE id=%s", (device_id,))
            row = await cur.fetchone()
            if not row:
                print(f"[LOG ERRO] Dispositivo com ID {device_id} não encontrado")
                return

            # Insere log
            await cur.execute(
                "INSERT INTO logsadmin (user_id, action, quando) VALUES (%s, %s, now())",
                (device_id, motivo)
            )
            await conn.commit()
    print(f"[LOG ADMIN] Ação registrada: {motivo} (device_id: {device_id})")

#------------------ REGISTRO DE DISPOSITIVOS ------------------
async def registrar_dispositivo(data: dict, addr):
    ip = addr[0] if isinstance(addr, tuple) else str(addr)
    device_id = await get_device_id_by_ip(ip)
    empresa_id = data.get("empresa_id")
    mac = data.get("mac_address")
    nome_host = data.get("hostname")

    if time.time() > EXPIRA_EM:
        print("[ERRO] Token expirado. Dispositivo não registrado.")
        if device_id:
            await log_admin_action("Token Expirado", device_id)
        return False

    # checar se empresa existe
    async with db_pool_user.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT id FROM Empresas WHERE id=%s", (empresa_id,))
            empresa = await cur.fetchone()
            if not empresa:
                print(f"[ERRO] Empresa {empresa_id} não encontrada.")
                if device_id:
                    await log_admin_action(f"Empresa {empresa_id} não encontrada", device_id)
                return False

            # inserir ou atualizar
            await cur.execute("""
                INSERT INTO Dispositivos (empresaid, code_used, ip, created_at)
                VALUES (%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE
                    ip = VALUES(ip),
                    created_at = VALUES(created_at),
                    code_used = VALUES(code_used)
            """, (empresa_id, APP_TOKEN, ip, datetime.now()))
            await conn.commit()

    print(f"[OK] Dispositivo registrado: {nome_host} ({mac}) - {ip} para empresa {empresa_id}")

    # log final
    device_id = await get_device_id_by_ip(ip)
    if device_id:
        await log_admin_action(f"Dispositivo registrado: {nome_host} ({mac}) para empresa {empresa_id}", device_id)

    return True
#------------------ HANDLER DE TCP ----------------------------
async def handler_dispositivos(reader, writer):
    ip = writer.get_extra_info("peername")[0]
    try:
        data_bytes = await reader.read(1024)
        data_json = json.loads(data_bytes.decode())
    except Exception:
        writer.write("Formato inválido. Envie JSON.\n".encode())
        await writer.drain()
        writer.close()
        await writer.wait_closed()
        return

    device_id = await get_device_id_by_ip(ip)
    if data_json.get("token") != APP_TOKEN:
        writer.write("Token incorreto.\n".encode())
        await writer.drain()
        if device_id:
            await log_admin_action("Token incorreto", device_id)
        writer.close()
        await writer.wait_closed()
        return

    success = await registrar_dispositivo(data_json, writer.get_extra_info("peername"))
    writer.write(f"{'Dispositivo registrado com sucesso.' if success else 'Falha ao registrar dispositivo.'}\n".encode())
    await writer.drain()

    if device_id:
        await log_admin_action("Dispositivo registrado com sucesso" if success else "Falha ao registrar dispositivo", device_id)

    writer.close()
    await writer.wait_closed()
#------------------ CRIAR EMPRESA -----------------------------
async def add_company(data: dict, device_id: int | None = None) -> int:
    async with db_pool_admin.acquire() as conn:
        async with conn.cursor() as cur:
            sql = """
            INSERT INTO empresas 
            (nome, razaosocial, telefone, email, chave_api, promptia, endereco, 
            mensagem_bemvindo, mensagem_lembrete, mensagem_confirmar, mensagem_confirmado, dispositivos, created_at, is_active) 
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now(),1)
            """
            await cur.execute(sql, (
                data.get("name"),
                data.get("razaosocial"),
                data.get("telefone"),
                data.get("email"),
                data.get("chave_api"),
                data.get("promptia"),
                data.get("endereco"),
                data.get("welcomeMsg"),
                data.get("confirmMsg"),
                data.get("confirmedMsg"),
                data.get("dispositivos", "")
            ))
            await conn.commit()
            empresa_id = cur.lastrowid  # pega o id do insert
            print(f"[ADD] Empresa criada: {data.get('name')} (ID: {empresa_id})")

            if device_id:
                nome_empresa = data.get('name') or 'NOME_DESCONHECIDO'
                await log_admin_action(f"Empresa Criada: {nome_empresa} (ID: {empresa_id})", device_id)

            return empresa_id
#------------------ EDITAR EMPRESA ----------------------------
async def update_company(data: dict, device_id: int | None = None) -> bool:
    async with db_pool_admin.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                UPDATE Empresas 
                SET nome=%s, razaosocial=%s, telefone=%s, email=%s, 
                    chave_api=%s, promptia=%s, endereco=%s, 
                    mensagem_bemvindo=%s, mensagem_lembrete=%s, 
                    mensagem_confirmar=%s, mensagem_confirmado=%s, 
                    dispositivos=%s, created_at=%s, is_active=%s
                WHERE id=%s
                """,
                (
                    data.get("name"),
                    data.get("razaosocial"),
                    data.get("telefone"),
                    data.get("email"),
                    data.get("chave_api"),
                    data.get("promptia"),
                    data.get("endereco"),
                    data.get("welcomeMsg"),
                    data.get("confirmMsg"),
                    data.get("confirmedMsg"),
                    data.get("dispositivos", ""),
                    data.get("created_at", datetime.now()),
                    data.get("is_active", 1),
                    data.get("id")
                ),
            )
        await conn.commit()

    print(f"[UPDT] Empresa atualizada: {data.get('name')} (ID: {data.get('id')})")

    # Log correto
    if device_id:
        nome_empresa = data.get('name') or 'NOME_DESCONHECIDO'
        await log_admin_action(f"Empresa atualizada: {nome_empresa} (ID: {data.get('id')})", device_id)

    return True
#------------------ LISTAR EMPRESA ----------------------------
async def list_companies():
    async with db_pool_admin.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("SELECT * FROM Empresas")
            return await cur.fetchall()
#------------------ PEGAR DADOS EMPRESA -----------------------
async def get_company_full(id: int):
    async with db_pool_admin.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("SELECT * FROM Empresas WHERE id=%s", (id,))
            empresa = await cur.fetchone()
            if not empresa:
                return None
            await cur.execute("SELECT Tipo, Texto FROM Mensagens_Placeholder WHERE EmpresaID=%s", (id,))
            placeholders = await cur.fetchall()
            empresa['placeholders'] = {ph['Tipo']: ph['Texto'] for ph in placeholders}
            return empresa
#cerebro parou de cerebrar... [err] 404 love not found
#faria tudo por ela. mas não to pronto ainda
#se eu pudesse largar tudo por ela, eu largaria
#agora já não dá pra fazer codigo, sono bateu, e não paro de pensar nela
#--------------- HANDLER DE CLIENTE(DISPOSITIVO) --------------
async def handle_admin_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    addr = writer.get_extra_info("peername")
    ip = addr[0]
    connected_admin.add(writer)

    device_id = await get_device_id_by_ip(ip)
    print(f"[ADMIN LOG] Cliente conectado: {addr}")
    if device_id:
        await log_admin_action(f"Cliente conectado: {ip}", device_id)
    else:
        print(f"[ADMIN LOG] Cliente conectado: {ip} (device_id não encontrado)")

    is_superadmin = False

    try:
        data = await reader.readline()
        if not data:
            print(f"[ADMIN LOG] Nada recebido na autenticação de {addr}, fechando.")
            return

        first_msg = data.decode(errors="ignore").strip()
        # não logar senha em texto; registrar apenas tamanho/marca
        print(f"[ADMIN LOG] Primeiro pacote de {addr} recebido (len={len(first_msg)})")

        if first_msg == APP_PASSWORD:
            is_superadmin = True
            resp = {"success": True, "msg": "autenticado_superadmin"}
            writer.write((json.dumps(resp) + "\n").encode())
            await writer.drain()
            print(f"[ADMIN LOG] Superadmin autenticado: {addr}")
        else:
            resp = {"success": False, "msg": "senha incorreta"}
            writer.write((json.dumps(resp) + "\n").encode())
            await writer.drain()
            print(f"[ADMIN LOG] Tentativa de autenticação falhou de {addr}")
            return
        while not reader.at_eof():
            data = await reader.readline()
            if not data:
                break
            mensagem = data.decode(errors="ignore").rstrip()
            REQUEST_LOG.append(f"{datetime.now()} - {addr} - {mensagem}")

            try:
                msg = json.loads(mensagem)
            except json.JSONDecodeError:
                writer.write((json.dumps({"success": False, "message": "Envie JSON."}) + "\n").encode())
                await writer.drain()
                continue

            if not is_superadmin:
                if not await validar_token(msg.get("token", ""), ip):
                    writer.write(("[ERROR] Token inválido\n").encode())
                    await writer.drain()
                    continue

            action = msg.get("action")
            data_payload = msg.get("data", {})
            response = {"success": True}

            try:
                match action:
                    case "list-companies":
                        response["companies"] = await list_companies()
                    case "create-company":
                        empresa_id = await add_company(data_payload, device_id)
                        response["empresaId"] = empresa_id
                    case "get-company-full":
                        response["empresa"] = await get_company_full(data_payload.get("id"))
                    case "update-company":
                        await update_company(data_payload, device_id)
                    case _:
                        response = {"success": False, "message": "Ação desconhecida"}

                writer.write((json.dumps(response) + "\n").encode())
                await writer.drain()
            except Exception as e:
                writer.write((json.dumps({"success": False, "message": str(e)}) + "\n").encode())
                await writer.drain()

    finally:
        connected_admin.discard(writer)
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass
        print(f"[ADMIN LOG] Cliente desconectado: {addr}")
        if device_id:
            await log_admin_action(f"Cliente desconectado: {ip}", device_id)
# ------------------ VERIFICADOR DE LOGIN DO ADMIN ------------------
async def verificador(data_json: dict, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> bool:
    addr = writer.get_extra_info("peername")
    ip = addr[0] if isinstance(addr, tuple) else str(addr)

    # Busca ID do admin pelo IP
    admin_id = await get_adminid_by_ip(ip)
    if not admin_id:
        response = {"success": False, "message": "Dispositivo não encontrado. Faça login com token."}
        await enviar_resposta(writer, response)
        print(f"[LOGIN FALHOU] Dispositivo {ip} não encontrado no banco.")
        return False

    async with db_pool_admin.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT senha FROM dispositivosadmin WHERE id=%s", (admin_id,))
            row = await cur.fetchone()

            if not row:
                response = {"success": False, "message": "Dispositivo não registrado."}
                await enviar_resposta(writer, response)
                print(f"[LOGIN FALHOU] Dispositivo {ip} sem registro.")
                return False

            senha_db = row[0]
            senha_enviada = data_json.get("senha")

           
            if senha_enviada != senha_db:
                response = {"success": False, "message": "Senha incorreta. Acesso negado."}
                await enviar_resposta(writer, response)
                print(f"[LOGIN NEGADO] IP {ip} enviou senha incorreta.")
                return False

            response = {"success": True, "message": "Acesso autorizado."}
            await enviar_resposta(writer, response)
            print(f"[LOGIN OK] Admin ID {admin_id} logado com sucesso ({ip})")
            return True


# ------------------ BUSCA ID PELO IP ------------------
async def get_adminid_by_ip(ip: str) -> int | None:
    """
    Retorna o ID do admin baseado no IP, se existir.
    """
    async with db_pool_admin.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT id FROM dispositivosadmin WHERE ip=%s", (ip,))
            row = await cur.fetchone()
            if row:
                return row[0]
            return None

# se tu chegou até aq. boa sorte entendendo o resto
# ------------------ FUNÇÃO AUXILIAR PRA ENVIAR JSON ------------------
async def enviar_resposta(writer: asyncio.StreamWriter, data: dict):
    """
    Envia um dicionário JSON pro aplicativo via TCP.
    """
    msg = json.dumps(data, ensure_ascii=False) + "\n"
    writer.write(msg.encode())
    await writer.drain()
#-----------------------------------------------------------------------------------------------------------------------------------------
#------- LOGICA DO USER
#-----------------------------------------------------------------------------------------------------------------------------------------
#---------- Handler User ----------
async def handle_user_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    addr = writer.get_extra_info("peername")
    connected_user.add(writer)
    print(f"[USER LOG] Cliente conectado: {addr}")

    try:
        while not reader.at_eof():
            data = await reader.readline()
            if not data:
                break
            s = data.decode(errors="ignore").rstrip()
            REQUEST_LOG.append(f"{datetime.now()} - {addr} - {s}")

            try:
                msg = json.loads(s)
            except json.JSONDecodeError:
                writer.write("Envie JSON.\n".encode())
                await writer.drain()
                continue

            if msg.get("token") != APP_TOKEN:
                writer.write("[ERROR] Token inválido\n".encode())
                await writer.drain()
                continue

            if "device" in msg:
                success = await logar_dispositivo(msg["device"], addr)
                writer.write(f"{'Dispositivo logado' if success else 'Falha ao logar'}\n".encode())
                await writer.drain()
    finally:
        connected_user.discard(writer)
        writer.close()
        await writer.wait_closed()
        print(f"[USER LOG] Cliente desconectado: {addr}")
#------------------ LOGAR DISPOSITIVO --------------------------
async def logar_dispositivo(data: dict, addr) -> bool:
    ip = addr[0] if isinstance(addr, tuple) else str(addr)

    # Verifica se já existe dispositivo
    device_id = await get_device_id_by_ip(ip)
    if device_id:
        print(f"[LOGIN] Dispositivo já registrado: {ip} (ID: {device_id})")
        return True  # passa direto

    # Se não tiver, precisa de token
    token = data.get("token")
    if token != APP_TOKEN:
        print(f"[LOGIN] Token inválido para dispositivo {ip}")
        return False

    # Token válido, registrar dispositivo
    success = await registrar_dispositivo(data, addr)
    if success:
        print(f"[LOGIN] Dispositivo registrado com sucesso: {ip}")
    else:
        print(f"[LOGIN] Falha ao registrar dispositivo: {ip}")
    return success
    #----------------------------------------------------
#ainda não tem logica o suficiente, nem aplicativo pronto pra iniciar a produção do servidor usuario
#aqui fica vazio até terminar de fazer o checklist de admin
#-----------------------------------------------------------------------------------------------------------------------------------------
#------- INICIALIZAÇÃO DO SISTEMA 
#-----------------------------------------------------------------------------------------------------------------------------------------

async def start_admin_server_async(host=HOST, port=ADMIN_PORT):
    await init_dbadmin()
    server = await asyncio.start_server(handle_admin_client, host, port)
    print(f"[ADMIN] Servidor rodando na porta {port}")
    async with server:
        await server.serve_forever()

def start_server(host=HOST, port=ADMIN_PORT):
    asyncio.run(start_admin_server_async(host, port))

async def start_user_server_async(host=HOST, port=USER_PORT):
    await init_dbuser()
    server = await asyncio.start_server(handle_user_client, host, port)
    print(f"[USER] Servidor rodando na porta {port}")
    async with server:
        await server.serve_forever()

def start_user_server(host=HOST, port=USER_PORT):
    asyncio.run(start_user_server_async(host, port))

async def main():
    task_admin = asyncio.create_task(start_admin_server_async(HOST, ADMIN_PORT))
    task_user = asyncio.create_task(start_user_server_async(HOST, USER_PORT))
    await asyncio.gather(task_admin, task_user)
#-----------------------------------------------------------------------------------------------------------------------------------------
#------- Start
#-----------------------------------------------------------------------------------------------------------------------------------------
if __name__ == "__main__":
    print("[Creditos] Sistema feito com Suor e Sangue por GirelliDev")
    print("[IronWatch] Iniciando Servidores...")
    print("ok")
    asyncio.run (main())
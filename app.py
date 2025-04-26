import logging
from flask import Flask, jsonify, request, session, redirect, render_template, send_from_directory
import sqlite3
import json
import datetime
import os
from werkzeug.utils import secure_filename
import bcrypt
import secrets
from flask_cors import CORS
import uuid  # Para gerar nomes de arquivo únicos

# Primeiro, configure o logging básico
logging.basicConfig(level=logging.DEBUG)

# Depois crie a instância do Flask
app = Flask(__name__, 
    static_folder='static',
    template_folder='templates'  # Adicione esta linha se seus templates não estiverem na pasta padrão
)

# Agora você pode configurar o logger da aplicação
app.logger.setLevel(logging.DEBUG)

# Configuração do Flask
app.secret_key = secrets.token_hex(16)  # Required for session management
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload

# Adicionar origens específicas para CORS
CORS(app, supports_credentials=True, origins=[
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:5000",
    "http://localhost:5000"
])

# Assegurar que o diretório de uploads existe
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Certifique-se de que a pasta upload existe
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

# Adicionar rota para servir arquivos de upload
@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# Função para verificar extensões de arquivo permitidas
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Initialize SQLite database
def init_db():
    conn = sqlite3.connect('quiz.db')
    c = conn.cursor()
    
    # Definição correta da tabela users
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Verificar se já existe um admin, se não criar um padrão
    c.execute("SELECT COUNT(*) FROM users WHERE is_admin = 1")
    if c.fetchone()[0] == 0:
        # Criar admin padrão - username: admin, senha: admin123
        hashed_password = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt())
        c.execute("INSERT INTO users (username, password, is_admin) VALUES (?, ?, 1)",
                 ('admin', hashed_password))
    
    # Responses table - adicionando campo observations
    c.execute('''CREATE TABLE IF NOT EXISTS responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        quiz_type TEXT NOT NULL,
        question_number REAL NOT NULL,
        question_text TEXT NOT NULL,
        answer TEXT NOT NULL,
        observations TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Nova tabela para armazenar fotos
    c.execute('''CREATE TABLE IF NOT EXISTS response_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        response_id INTEGER NOT NULL,
        photo_path TEXT NOT NULL,
        FOREIGN KEY (response_id) REFERENCES responses (id)
    )''')
    
    # Table to store available quiz types
    c.execute('''CREATE TABLE IF NOT EXISTS quiz_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL
    )''')
    
    # Criar nova tabela para localização
    c.execute('''
    CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        response_id INTEGER,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy REAL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (response_id) REFERENCES responses(id)
    )
    ''')
    
    # Adicionar a tabela de observações
    c.execute('''CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        quiz_type TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp DATETIME NOT NULL
    )''')
    
    # FIX: Use the correct quiz data
    quiz_types_data = [
        ('pre_operacional', 'Checklist Pré-Operacional'),
        ('caminhao', 'Checklist Caminhão'),
        ('carga', 'Checklist Carga')
    ]
    
    # FIX: Insert the correct data
    for quiz_name, quiz_desc in quiz_types_data:
        c.execute('INSERT OR IGNORE INTO quiz_types (name, description) VALUES (?, ?)', 
                 (quiz_name, quiz_desc)) # Use quiz_name as the key (name) and quiz_desc as the description
    
    # Insert a default user for testing (username: admin, password: admin123)
    hashed_password = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt())
    c.execute('INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)', ('admin', hashed_password))
    
    conn.commit()
    conn.close()

def check_and_update_db_schema():
    conn = sqlite3.connect('quiz.db')
    c = conn.cursor()
    
    # Verificar se a coluna observations existe na tabela 'responses'
    c.execute("PRAGMA table_info(responses)")
    columns = [col[1] for col in c.fetchall()]
    app.logger.info(f"Colunas existentes: {columns}")
    
    # Se não existir, adicionar
    if 'observations' not in columns:
        app.logger.info("Adicionando coluna 'observations' à tabela responses")
        c.execute("ALTER TABLE responses ADD COLUMN observations TEXT")
        
    conn.commit()
    conn.close()

# Initialize DB if it doesn't exist
if not os.path.exists('quiz.db'):
    init_db()
check_and_update_db_schema()

# Rota para a página principal
@app.route('/')
def index():
    # Verificar se o usuário está logado
    if 'username' not in session:
        # Se não estiver logado, redirecionar para a página de login
        return redirect('/login.html')
    
    # Se estiver logado, verificar se é admin
    if session.get('is_admin'):
        # Se for admin, pode redirecionar para dashboard admin
        return redirect('/admin/dashboard')
    else:
        # Se for usuário normal, redirecionar para a página principal 
        # ou servir diretamente o arquivo index.html
        return app.send_static_file('index.html')

@app.route('/login.html')
def serve_login():
    # Se já estiver logado, redirecionar para página principal
    if 'username' in session:
        return redirect('/')
    return app.send_static_file('login.html')

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    conn = sqlite3.connect('quiz.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT id, password, is_admin FROM users WHERE username = ?', (username,))
    result = c.fetchone()
    conn.close()

    if result and bcrypt.checkpw(password.encode('utf-8'), result['password']):
        session['username'] = username  # Store username in session
        session['user_id'] = result['id']
        
        # Definir se o usuário é admin ou não
        is_admin = bool(result['is_admin'])
        session['is_admin'] = is_admin
        
        return jsonify({
            'message': 'Login successful', 
            'is_admin': is_admin
        }), 200
        
    return jsonify({'message': 'Invalid credentials'}), 401

# Logout do usuário
@app.route('/logout', methods=['POST'])
def logout():
    # Limpar a sessão do usuário
    session.clear()
    return jsonify({'success': True}), 200

@app.route('/quizzes', methods=['GET'])
def get_available_quizzes():
    # Check if user is logged in
    if 'username' not in session:
        return jsonify({'message': 'User not logged in'}), 401
    
    conn = sqlite3.connect('quiz.db')
    c = conn.cursor()
    # Fetch the key (name) and the description
    c.execute('SELECT name, description FROM quiz_types') 
    # Return both: 'id' will be the key (e.g., 'pre_operacional'), 'name' will be the description
    quizzes = [{'id': row[0], 'name': row[1]} for row in c.fetchall()] 
    conn.close()
    
    return jsonify({'quizzes': quizzes}), 200

@app.route('/submit', methods=['POST'])
def submit_quiz():
    app.logger.info("Iniciando processamento do envio de checklist")
    app.logger.info(f"Formulário recebido: {request.form}")
    
    # Logging para upload de arquivos
    if 'photo1' in request.files:
        app.logger.info("Arquivo de foto detectado no formulário")
    else:
        app.logger.info("Nenhum arquivo de foto detectado")
    
    if 'username' not in session:
        return jsonify({'message': 'User not logged in'}), 401
    
    username = session['username']
    
    try:
        # Obter dados básicos do formulário
        quiz_type = request.form.get('quizType')
        responses_json = request.form.get('responses')
        observations = request.form.get('observations', '')
        app.logger.info(f"Observações recebidas: {observations}")
        
        if not quiz_type or not responses_json:
            app.logger.error(f"Dados insuficientes: quiz_type={quiz_type}, responses={bool(responses_json)}")
            return jsonify({'message': 'Dados insuficientes para processamento'}), 400
        
        responses = json.loads(responses_json)
        app.logger.debug(f"Processando quiz tipo: {quiz_type} com {len(responses)} respostas")
        
        # Conectar ao banco de dados
        conn = sqlite3.connect('quiz.db')
        c = conn.cursor()
        
        # Registrar timestamp
        timestamp = datetime.datetime.now().isoformat()
        
        # Inserir respostas no banco
        first_response_id = None
        
        for response in responses:
            c.execute('''
                INSERT INTO responses 
                (username, quiz_type, question_number, question_text, answer, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                username, 
                quiz_type,
                response['number'],
                response['text'],
                response['answer'],
                timestamp
            ))
            
            if first_response_id is None:
                first_response_id = c.lastrowid
        
        # Processar localização (opcional, apenas para pré-operacional)
        location_json = request.form.get('location')
        if location_json and quiz_type == 'pre_operacional':
            try:
                location_data = json.loads(location_json)
                # Adicionar localização às observações
                location_text = f"\n\nLOCALIZAÇÃO:\nLat: {location_data['latitude']}\nLong: {location_data['longitude']}\nPrecisão: {location_data.get('accuracy', 0)} metros"
                
                if observations:
                    observations += location_text
                else:
                    observations = location_text
                
                # Usar a tabela de localização se existir
                c.execute('''
                    INSERT INTO locations 
                    (response_id, latitude, longitude, accuracy)
                    VALUES (?, ?, ?, ?)
                ''', (
                    first_response_id,
                    location_data['latitude'],
                    location_data['longitude'],
                    location_data.get('accuracy', 0)
                ))
            except Exception as loc_error:
                app.logger.error(f"Erro ao processar localização: {str(loc_error)}")
                # Continue mesmo com erro na localização
        
        # Inserir observações
        if observations:
            c.execute('''
                INSERT INTO observations 
                (username, quiz_type, text, timestamp)
                VALUES (?, ?, ?, ?)
            ''', (username, quiz_type, observations, timestamp))
        
        # Processar fotos
        photos = []
        for i in range(1, 4):  # Máximo de 3 fotos
            if f'photo{i}' in request.files:
                photo = request.files[f'photo{i}']
                if photo and allowed_file(photo.filename):
                    # Gerar nome único para o arquivo
                    filename = secure_filename(f"{uuid.uuid4()}_{photo.filename}")
                    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    photo.save(file_path)
                    
                    # Inserir registro da foto no banco
                    c.execute('''
                        INSERT INTO response_photos (response_id, photo_path)
                        VALUES (?, ?)
                    ''', (first_response_id, file_path))
                    
                    # Adicionar caminho da foto à lista de fotos
                    photos.append({'path': file_path})
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Checklist enviado com sucesso!'}), 200
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        app.logger.error(f'Erro ao processar submissão: {str(e)}')
        app.logger.error(error_trace)
        return jsonify({'message': f'Erro ao enviar respostas: {str(e)}'}), 500

# Melhorar a rota existente /user/history para suportar filtros por data
@app.route('/user/history', methods=['GET'])
def get_user_history():
    if 'username' not in session:
        return jsonify({'message': 'User not logged in'}), 401
    
    username = session['username']
    
    # Parâmetros da requisição
    from_date = request.args.get('from_date')
    to_date = request.args.get('to_date')
    limit = request.args.get('limit', '7')
    
    # Debug para ajudar a identificar o problema
    app.logger.debug(f"Filtro de histórico - de: {from_date}, até: {to_date}, limit: {limit}")
    
    query = '''
        SELECT 
            MAX(r.id) AS id, 
            r.quiz_type, 
            qt.description AS quiz_description, 
            COUNT(DISTINCT r.question_number) AS question_count, 
            MAX(r.timestamp) AS last_attempt
        FROM responses r
        JOIN quiz_types qt ON r.quiz_type = qt.name
        WHERE r.username = ?
    '''
    
    params = [username]
    
    # Adicionar filtros de data se especificados
    if from_date:
        query += " AND r.timestamp >= ?"
        # Garantir que a data comece no início do dia
        start_date = from_date + " 00:00:00" if " " not in from_date else from_date
        params.append(start_date)
    
    if to_date:
        query += " AND r.timestamp <= ?"
        # Garantir que a data vá até o fim do dia
        end_date = to_date + " 23:59:59" if " " not in to_date else to_date
        params.append(end_date)
    
    # Agrupar e ordenar
    query += " GROUP BY r.timestamp, r.username, r.quiz_type ORDER BY r.timestamp DESC"
    
    # Aplicar limite se especificado
    if limit and int(limit) > 0:
        query += f" LIMIT {int(limit)}"
        
    app.logger.debug(f"Query final: {query}")
    app.logger.debug(f"Parâmetros: {params}")
    
    conn = sqlite3.connect('quiz.db')
    conn.row_factory = sqlite3.Row  # Para obter resultados como dicts
    c = conn.cursor()
    
    c.execute(query, params)
    
    history = []
    for row in c.fetchall():
        history.append({
            'id': row['id'],
            'quiz_type': row['quiz_type'],
            'quiz_description': row['quiz_description'],
            'question_count': row['question_count'],
            'last_attempt': row['last_attempt']
        })
    
    conn.close()
    
    return jsonify({'history': history}), 200

# Nova rota para obter detalhes de um checklist específico
@app.route('/quiz/<int:quiz_id>/details', methods=['GET'])
def get_quiz_details(quiz_id):
    app.logger.debug(f"Tentando acessar detalhes do quiz {quiz_id}")
    
    if 'username' not in session:
        return jsonify({'message': 'User not logged in'}), 401
    
    username = session['username']
    
    conn = sqlite3.connect('quiz.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    # Buscar informações básicas da resposta
    c.execute('''
        SELECT r.quiz_type, r.timestamp
        FROM responses r
        WHERE r.id = ? AND r.username = ?
    ''', (quiz_id, username))
    
    basic_info = c.fetchone()
    
    if not basic_info:
        conn.close()
        return jsonify({'message': 'Checklist não encontrado ou sem permissão'}), 404
    
    quiz_type = basic_info['quiz_type']
    timestamp = basic_info['timestamp']
    
    # Buscar todas as respostas
    c.execute('''
        SELECT r.question_number, r.question_text, r.answer
        FROM responses r
        WHERE r.username = ? AND r.quiz_type = ? AND r.timestamp = ?
        ORDER BY r.question_number
    ''', (username, quiz_type, timestamp))
    
    questions = []
    for row in c.fetchall():
        questions.append({
            'number': row['question_number'],
            'text': row['question_text'],
            'answer': row['answer']
        })
    
    # Buscar observações do banco
    c.execute('''
        SELECT text FROM observations 
        WHERE username = ? AND timestamp = ? AND quiz_type = ?
    ''', (username, timestamp, quiz_type))
    
    observation_row = c.fetchone()
    observations = observation_row['text'] if observation_row else ""
    
    app.logger.debug(f"Observações encontradas: {observations}")
    
    # Buscar informações de localização (apenas para pre_operacional)
    location = None
    if quiz_type == 'pre_operacional':
        c.execute('''
            SELECT l.latitude, l.longitude, l.accuracy
            FROM locations l
            JOIN responses r ON l.response_id = r.id
            WHERE r.username = ? AND r.quiz_type = ? AND r.timestamp = ?
            LIMIT 1
        ''', (username, quiz_type, timestamp))
        
        location_row = c.fetchone()
        if location_row:
            location = {
                'latitude': location_row['latitude'],
                'longitude': location_row['longitude'],
                'accuracy': location_row['accuracy']
            }
    
    # Buscar fotos
    c.execute("""
        SELECT rp.photo_path as path
        FROM response_photos rp
        JOIN responses r ON rp.response_id = r.id
        WHERE r.username = ? AND r.quiz_type = ? AND r.timestamp = ?
    """, (username, quiz_type, timestamp))
    
    photos = [{'path': row['path']} for row in c.fetchall()]
    app.logger.debug(f"Fotos encontradas: {photos}")
    
    conn.close()
    
    app.logger.debug(f"Retornando detalhes do quiz {quiz_id} para {username}")
    return jsonify({
        'details': {
            'id': quiz_id,
            'type': quiz_type,
            'date': timestamp,
            'questions': questions,
            'observations': observations,
            'location': location,
            'photos': photos
        }
    }), 200

# Verificar se o usuário está logado
@app.route('/check-login', methods=['GET'])
def check_login():
    if 'username' not in session:
        return jsonify({'message': 'User not logged in'}), 401
    
    return jsonify({
        'username': session['username'],
        'is_admin': session.get('is_admin', False)
    }), 200

@app.route('/admin/dashboard')
def admin_dashboard():
    if 'is_admin' not in session or not session['is_admin']:
        return redirect('/')
    return render_template('admin_dashboard.html', username=session.get('username'))

@app.route('/admin/api/users', methods=['GET'])
def get_all_users():
    if 'is_admin' not in session or not session['is_admin']:
        return jsonify({'error': 'Unauthorized'}), 401
        
    conn = sqlite3.connect('quiz.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT id, username, created_at, is_admin FROM users ORDER BY username")
    users = [dict(row) for row in c.fetchall()]
    conn.close()
    
    return jsonify({'users': users})

@app.route('/admin/api/quizzes', methods=['GET'])
def get_all_quizzes():
    if 'is_admin' not in session or not session['is_admin']:
        return jsonify({'error': 'Unauthorized'}), 401
        
    conn = sqlite3.connect('quiz.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    # Buscar quizzes agrupados por usuário
    c.execute('''
        SELECT DISTINCT r.username, r.quiz_type, r.timestamp 
        FROM responses r
        ORDER BY r.timestamp DESC
    ''')
    
    quizzes = []
    for row in c.fetchall():
        quizzes.append({
            'username': row['username'],
            'quiz_type': row['quiz_type'],
            'timestamp': row['timestamp']
        })
    
    conn.close()
    
    return jsonify({'quizzes': quizzes})

@app.route('/admin/api/users/create', methods=['POST'])
def create_user():
    if 'is_admin' not in session or not session['is_admin']:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        is_admin = data.get('is_admin', False)
        
        if not username or not password:
            return jsonify({'error': 'Username e senha são obrigatórios'}), 400
            
        # Verificar se usuário já existe
        conn = sqlite3.connect('quiz.db')
        c = conn.cursor()
        c.execute("SELECT id FROM users WHERE username = ?", (username,))
        if c.fetchone():
            conn.close()
            return jsonify({'error': 'Usuário já existe'}), 400
            
        # Criar novo usuário
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        c.execute("INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)",
                 (username, hashed_password, 1 if is_admin else 0))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Usuário criado com sucesso'})
        
    except Exception as e:
        app.logger.error(f"Erro ao criar usuário: {str(e)}")
        return jsonify({'error': f'Erro ao criar usuário: {str(e)}'}), 500

@app.route('/admin/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    if 'is_admin' not in session or not session['is_admin']:
        return jsonify({'error': 'Unauthorized'}), 401
    
    # Não permitir que o admin exclua a si mesmo
    if user_id == session.get('user_id'):
        return jsonify({'error': 'Você não pode excluir sua própria conta'}), 400
        
    try:
        conn = sqlite3.connect('quiz.db')
        c = conn.cursor()
        c.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Usuário excluído com sucesso'})
        
    except Exception as e:
        app.logger.error(f"Erro ao excluir usuário: {str(e)}")
        return jsonify({'error': f'Erro ao excluir usuário: {str(e)}'}), 500

@app.route('/admin/quiz-details', methods=['GET'])
def admin_quiz_details():
    if 'is_admin' not in session or not session['is_admin']:
        return redirect('/admin/login')
    
    return render_template('admin_quiz_details.html')

@app.route('/admin/api/quiz-details', methods=['GET'])
def api_quiz_details():
    if 'is_admin' not in session or not session['is_admin']:
        return jsonify({'error': 'Acesso não autorizado'}), 401
    
    # Obter parâmetros da requisição
    username = request.args.get('username')
    quiz_type = request.args.get('quiz_type')
    timestamp = request.args.get('timestamp')
    
    app.logger.debug(f"Parâmetros recebidos: {username}, {quiz_type}, {timestamp}")
    
    if not username or not quiz_type or not timestamp:
        return jsonify({'error': 'Parâmetros incompletos'}), 400
    
    try:
        conn = sqlite3.connect('quiz.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Verificar se o timestamp precisa de ajuste (formato T vs espaço)
        c.execute("""
            SELECT DISTINCT timestamp 
            FROM responses 
            WHERE username = ? AND quiz_type = ? AND (timestamp = ? OR timestamp LIKE ?)
            LIMIT 1
        """, (username, quiz_type, timestamp, timestamp.split('T')[0] + '%'))
        
        result = c.fetchone()
        if result:
            # Usar o timestamp exato do banco
            actual_timestamp = result['timestamp']
            app.logger.debug(f"Timestamp encontrado no banco: {actual_timestamp}")
        else:
            app.logger.debug(f"Nenhum registro encontrado com timestamp similar")
            return jsonify({'error': 'Checklist não encontrado'}), 404
        
        # Buscar perguntas e respostas usando o timestamp correto
        c.execute("""
            SELECT 
                question_number,
                question_text as text,
                answer
            FROM responses
            WHERE username = ? AND quiz_type = ? AND timestamp = ?
            ORDER BY question_number
        """, (username, quiz_type, actual_timestamp))
        
        questions = [dict(row) for row in c.fetchall()]
        
        # Buscar observações
        c.execute("""
            SELECT observations 
            FROM responses 
            WHERE username = ? AND quiz_type = ? AND timestamp = ? 
            AND observations IS NOT NULL AND observations != ''
            LIMIT 1
        """, (username, quiz_type, actual_timestamp))
        
        obs_row = c.fetchone()
        observations = obs_row['observations'] if obs_row else ""
        
        # Buscar localização
        c.execute("""
            SELECT l.latitude, l.longitude, l.accuracy
            FROM locations l
            JOIN responses r ON l.response_id = r.id
            WHERE r.username = ? AND r.quiz_type = ? AND r.timestamp = ?
            LIMIT 1
        """, (username, quiz_type, actual_timestamp))
        
        loc_row = c.fetchone()
        location = None
        if loc_row:
            location = {
                'latitude': loc_row['latitude'],
                'longitude': loc_row['longitude'],
                'accuracy': loc_row['accuracy']
            }
        
        # Buscar fotos
        c.execute("""
            SELECT rp.photo_path as path
            FROM response_photos rp
            JOIN responses r ON rp.response_id = r.id
            WHERE r.username = ? AND r.quiz_type = ? AND r.timestamp = ?
        """, (username, quiz_type, actual_timestamp))
        
        photos = [{'path': row['path']} for row in c.fetchall()]
        app.logger.debug(f"Fotos encontradas: {photos}")
        
        conn.close()
        
        return jsonify({
            'questions': questions,
            'observations': observations,
            'location': location,
            'photos': photos,
            'username': username,
            'quiz_type': quiz_type,
            'timestamp': actual_timestamp
        }), 200
        
    except Exception as e:
        app.logger.error(f"Erro ao buscar detalhes: {str(e)}")
        app.logger.exception(e)  # Adicione esta linha para ver o traceback completo
        return jsonify({'error': f'Erro no servidor: {str(e)}'}), 500

@app.route('/admin/api/statistics', methods=['GET'])
def admin_statistics():
    if 'is_admin' not in session or not session['is_admin']:
        return jsonify({'error': 'Unauthorized'}), 401
    
    period = request.args.get('period', 'daily')
    app.logger.info(f"Obtendo estatísticas administrativas para período: {period}")
    
    try:
        conn = sqlite3.connect('quiz.db')
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # 1. Obter estatísticas por período
        date_format = '%Y-%m-%d'  # Formato padrão para agrupar por dia
        date_extract = "strftime('%Y-%m-%d', timestamp)"
        
        if period == 'monthly':
            date_format = '%Y-%m'
            date_extract = "strftime('%Y-%m', timestamp)"
        elif period == 'yearly':
            date_format = '%Y'
            date_extract = "strftime('%Y', timestamp)"
        
        # Consulta principal para estatísticas por período e tipo
        c.execute(f'''
            SELECT 
                {date_extract} as time_period,
                quiz_type,
                COUNT(DISTINCT timestamp) as count
            FROM responses
            GROUP BY time_period, quiz_type
            ORDER BY time_period
        ''')
        
        statistics = [dict(row) for row in c.fetchall()]
        
        # 2. Obter dados recentes sobre checklists
        c.execute('''
            SELECT 
                r.username,
                r.quiz_type,
                r.timestamp,
                COUNT(DISTINCT r.question_number) as questions_count,
                SUM(CASE WHEN r.answer = 'N/C' OR r.answer = 'NC' THEN 1 ELSE 0 END) as nc_count
            FROM responses r
            GROUP BY r.timestamp, r.username, r.quiz_type
            ORDER BY r.timestamp DESC
            LIMIT 50
        ''')
        
        recent_quizzes = [dict(row) for row in c.fetchall()]
        
        conn.close()
        
        return jsonify({
            'statistics': statistics,
            'recent_quizzes': recent_quizzes
        }), 200
        
    except Exception as e:
        app.logger.error(f"Erro nas estatísticas admin: {str(e)}")
        return jsonify({'error': f'Erro ao processar estatísticas: {str(e)}'}), 500

if __name__ == '__main__':
    # Run the Flask app in debug mode
    app.run(debug=True)
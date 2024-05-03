// Dependencias
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import connectToDB from './config/db.js'

// Modelos
const UsuarioSchema = new mongoose.Schema({
    tipo: { type: Number, required: true, enum: [1, 2] }, // 1 - Cliente, 2 - Profissional
    nome: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
});

const AgendamentoSchema = new mongoose.Schema({
    cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    profissional: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    data: { type: Date, required: true },
    horario: { type: String, required: true },
    servico: { type: String, required: true },
});

const Usuario = mongoose.model('Usuario', UsuarioSchema);
const Agendamento = mongoose.model('Agendamento', AgendamentoSchema);

// Aplicação Express
const app = express();
connectToDB()
app.use(express.json());


// Rota de cadastro
app.post('/cadastro', async (req, res) => {
    const { tipo, nome, email, senha } = req.body;
    const senhaHash = await bcrypt.hash(senha, 10);
    const usuario = new Usuario({ tipo, nome, email, senha: senhaHash });
    await usuario.save();
    res.json({ message: 'Usuário cadastrado com sucesso!' });
});

// Rota de login
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    const usuario = await Usuario.findOne({ email });
    if (!usuario || !await bcrypt.compare(senha, usuario.senha)) {
        return res.status(401).json({ error: 'Email ou senha inválidos.' });
    }
    const token = jwt.sign({ id: usuario._id, tipo: usuario.tipo }, 'secret'); // Substitua 'secret' por uma chave segura
    res.json({ token });
});

// Middleware de autenticação
function auth(req, res, next) {
    const token = req.headers.authorization.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token não fornecido.' });
    jwt.verify(token, 'secret', (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Token inválido.'});
        req.userId = decoded.id;
        req.userTipo = decoded.tipo;
        next();
    });
}

// Rotas de agendamento (protegidas por autenticação)
app.get('/agendamentos', auth, async (req, res) => {
    const usuario = await Usuario.findById(req.userId);
    let agendamentos;
    if (usuario.tipo === 1) { // Cliente
        agendamentos = await Agendamento.find({ cliente: req.userId }).populate('profissional');
    } else { // Profissional
        agendamentos = await Agendamento.find({ profissional: req.userId }).populate('cliente');
    }
    res.json(agendamentos);
});

app.post('/agendamentos', auth, async (req, res) => {
    const { profissionalId, data, horario, servico } = req.body;
    const clienteId = req.userId;

    // Validações básicas (expanda conforme necessário)
    if (!profissionalId || !data || !horario || !servico) {
        return res.status(400).json({ error: 'Dados incompletos para o agendamento.' });
    }

    // Verifica se o profissional existe e é realmente um profissional
    const profissional = await Usuario.findOne({ _id: profissionalId, tipo: 2 });
    if (!profissional) {
        return res.status(404).json({ error: 'Profissional não encontrado.' });
    }

    // Cria o agendamento
    const agendamento = new Agendamento({
        cliente: clienteId,
        profissional: profissionalId,
        data,
        horario,
        servico,
    });
    await agendamento.save();

    res.json({ message: 'Agendamento criado com sucesso!', agendamento });
});

// Rota para listar profissionais
app.get('/profissionais', auth, async (req, res) => {
    const profissionais = await Usuario.find({ tipo: 2 }, 'nome'); // Seleciona apenas o nome
    res.json(profissionais);
});

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
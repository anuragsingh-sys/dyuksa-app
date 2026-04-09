import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Modal, 
  TextInput 
} from 'react-native';
import { useState } from 'react';

export default function ProjectsScreen() {
  const [projects, setProjects] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [projectName, setProjectName] = useState('');

  const addProject = () => {
    if (!projectName) return;

    const newProject = {
      id: Date.now().toString(),
      name: projectName,
      status: 'In Progress'
    };

    setProjects([newProject, ...projects]);
    setProjectName('');
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>

      {/* Header */}
      <Text style={styles.title}>Projects</Text>

      {/* Create Button */}
      <TouchableOpacity 
        style={styles.button} 
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.buttonText}>+ Create Project</Text>
      </TouchableOpacity>

      {/* Empty State */}
      {projects.length === 0 ? (
        <Text style={styles.empty}>No projects yet</Text>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.projectName}>{item.name}</Text>
              <Text style={styles.status}>{item.status}</Text>
            </View>
          )}
        />
      )}

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalBox}>

            <Text style={styles.modalTitle}>Create Project</Text>

            <TextInput
              placeholder="Enter project name"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={projectName}
              onChangeText={setProjectName}
            />

            <TouchableOpacity style={styles.button} onPress={addProject}>
              <Text style={styles.buttonText}>Create</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold'
  },
  empty: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 50
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10
  },
  projectName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  status: {
    color: '#94a3b8',
    marginTop: 5
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)'
  },
  modalBox: {
    backgroundColor: '#1e293b',
    margin: 20,
    padding: 20,
    borderRadius: 12
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 10
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15
  }
});
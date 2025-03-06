// frontend/src/pages/Login.js
import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Heading, FormControl, FormLabel, Input, Button,
  Alert, AlertIcon, Link, Flex, Text, VStack
} from '@chakra-ui/react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    try {
      await login(username, password);
      navigate('/'); // Redirect to home page
    } catch (error) {
      setError(error.message);
    }
  };
  
  return (
    <Box 
      maxW="md" 
      mx="auto" 
      mt={10} 
      p={8} 
      bg="gray.800" 
      rounded="lg" 
      shadow="xl"
      borderWidth={1}
      borderColor="gray.700"
    >
      <VStack spacing={6}>
        <Heading mb={2} textAlign="center" color="white">Log In</Heading>
        
        {error && (
          <Alert status="error" mb={4} rounded="md" variant="solid" bg="red.600" color="white">
            <AlertIcon />
            {error}
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <FormControl mb={4} isRequired>
            <FormLabel color="gray.300">Username</FormLabel>
            <Input 
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              bg="gray.700"
              borderColor="gray.600"
              color="white"
              _hover={{ borderColor: "yellow.300" }}
              _focus={{ borderColor: "yellow.300", boxShadow: "0 0 0 1px yellow.300" }}
            />
          </FormControl>
          
          <FormControl mb={6} isRequired>
            <FormLabel color="gray.300">Password</FormLabel>
            <Input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              bg="gray.700"
              borderColor="gray.600"
              color="white"
              _hover={{ borderColor: "yellow.300" }}
              _focus={{ borderColor: "yellow.300", boxShadow: "0 0 0 1px yellow.300" }}
            />
          </FormControl>
          
          <Button 
            type="submit" 
            colorScheme="yellow" 
            width="full"
            isLoading={loading}
            size="lg"
            mt={2}
          >
            Log In
          </Button>
        </form>
        
        <Flex mt={2} justify="center">
          <Text mr={2} color="gray.400">Don't have an account?</Text>
          <Link as={RouterLink} to="/register" color="yellow.300" _hover={{ color: "yellow.200" }}>
            Register
          </Link>
        </Flex>
      </VStack>
    </Box>
  );
};

export default Login;
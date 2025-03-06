import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Heading, Text, Button, VStack, HStack, Image, 
  Container, SimpleGrid, Flex, Icon, useColorModeValue,
  Divider
} from '@chakra-ui/react';
import { FaTrophy, FaUserFriends, FaChartLine } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import lolImage from './lol.png';

const Feature = ({ icon, title, text }) => {
  return (
    <VStack 
      align="left" 
      p={6} 
      bg="gray.800" 
      borderRadius="lg" 
      boxShadow="md"
      _hover={{ transform: 'translateY(-5px)', transition: 'transform 0.3s' }}
    >
      <Flex
        w={12}
        h={12}
        align="center"
        justify="center"
        rounded="full"
        bg="yellow.400"
        mb={4}
      >
        <Icon as={icon} color="white" w={6} h={6} />
      </Flex>
      <Heading size="md" mb={2} color="white">
        {title}
      </Heading>
      <Text color="gray.400">{text}</Text>
    </VStack>
  );
};

const Home = () => {
  const { isAuthenticated } = useAuth();
  
  return (
    <Box>
      {/* Hero Section */}
      <Box 
        bgGradient="linear(to-r, gray.900, gray.800)"
        borderRadius="lg"
        overflow="hidden"
        mb={10}
      >
        <Container maxW="container.xl" py={16}>
          <Flex direction={{ base: 'column', md: 'row' }} align="center">
            <Box flex={1} pr={{ md: 10 }} mb={{ base: 10, md: 0 }}>
              <Heading 
                as="h1" 
                size="2xl" 
                mb={4}
                bgGradient="linear(to-r, yellow.400, orange.300)"
                bgClip="text"
              >
                Fantasy League of Legends
              </Heading>
              <Text fontSize="xl" color="gray.300" mb={8}>
                Create your dream team, compete with friends, and rise to the top of the standings 
                with our immersive LoL fantasy experience.
              </Text>
              <HStack spacing={3}>
                {isAuthenticated ? (
                  <Button 
                    as={RouterLink} 
                    to="/leagues" 
                    size="lg" 
                    colorScheme="yellow"
                    _hover={{ bg: 'yellow.500' }}
                  >
                    My Leagues
                  </Button>
                ) : (
                  <Button 
                    as={RouterLink} 
                    to="/register" 
                    size="lg" 
                    colorScheme="yellow"
                    _hover={{ bg: 'yellow.500' }}
                  >
                    Get Started
                  </Button>
                )}
                <Button 
                  as={RouterLink} 
                  to="/players" 
                  size="lg" 
                  variant="outline"
                  _hover={{ bg: 'whiteAlpha.100' }}
                  color="white"
                  borderColor="yellow.400"
                >
                  Browse Players
                </Button>
              </HStack>
            </Box>
            <Box flex={1}>
              <Image 
                src={lolImage}
                alt="Fantasy LoL"
                fallbackSrc="https://via.placeholder.com/600x400?text=Fantasy+LoL" 
                borderRadius="lg"
              />
            </Box>
          </Flex>
        </Container>
      </Box>

      {/* Features Section */}
      <Box mb={16}>
        <Container maxW="container.xl">
          <VStack mb={12} textAlign="center">
            <Heading color="white" mb={2}>How It Works</Heading>
            <Text color="gray.400" maxW="2xl">
              Our fantasy LoL platform brings the excitement of managing your own team
              of professional League of Legends players.
            </Text>
          </VStack>
          
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={10}>
            <Feature
              icon={FaUserFriends}
              title="Build Your Team"
              text="Draft the best professional players from around the world and create your dream team."
            />
            <Feature
              icon={FaChartLine}
              title="Track Performance"
              text="Watch your team score points based on real in-game statistics from professional matches."
            />
            <Feature
              icon={FaTrophy}
              title="Win Your League"
              text="Compete against friends and climb the rankings to become the ultimate fantasy manager."
            />
          </SimpleGrid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box bg="gray.800" py={16} borderRadius="lg">
        <Container maxW="container.xl" textAlign="center">
          <Heading mb={6} color="white">Ready to dive in?</Heading>
          <Text fontSize="lg" color="gray.300" mb={8} maxW="2xl" mx="auto">
            Join thousands of fantasy League of Legends enthusiasts and put your knowledge to the test.
          </Text>
          <Button 
            as={RouterLink} 
            to={isAuthenticated ? "/leagues" : "/register"} 
            size="lg" 
            colorScheme="yellow.400"
            px={8}
          >
            {isAuthenticated ? "View My Leagues" : "Create Account"}
          </Button>
        </Container>
      </Box>
    </Box>
  );
};

export default Home;
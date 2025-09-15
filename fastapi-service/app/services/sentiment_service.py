"""
Sentiment analysis service for processing message sentiment and triggering automation workflows.
"""
import logging
from typing import Dict, Any, Optional, List
from textblob import TextBlob
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)


class SentimentAnalyzer:
    """
    Service for analyzing message sentiment and detecting automation triggers.
    
    This service provides:
    - Real-time sentiment analysis using TextBlob
    - Sentiment score normalization (-1.0 to 1.0)
    - Trigger detection for automation workflows
    - Batch processing capabilities
    """
    
    def __init__(self):
        """Initialize the sentiment analyzer."""
        self._is_ready = False
        self._initialize()
    
    def _initialize(self):
        """Initialize the sentiment analysis components."""
        try:
            # Test TextBlob functionality
            test_blob = TextBlob("This is a test message.")
            _ = test_blob.sentiment.polarity
            
            self._is_ready = True
            logger.info("SentimentAnalyzer initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize SentimentAnalyzer: {e}")
            self._is_ready = False
    
    def is_ready(self) -> bool:
        """Check if the sentiment analyzer is ready."""
        return self._is_ready
    
    async def analyze_sentiment(self, message: str) -> Dict[str, Any]:
        """
        Analyze sentiment of a single message.
        
        Args:
            message: The message text to analyze
            
        Returns:
            Dictionary containing sentiment analysis results:
            - score: Sentiment score (-1.0 to 1.0)
            - label: Sentiment label (positive, negative, neutral)
            - confidence: Confidence level (0.0 to 1.0)
            - subjectivity: Subjectivity score (0.0 to 1.0)
            
        Raises:
            ValueError: If message is empty or invalid
            RuntimeError: If sentiment analysis fails
        """
        if not self._is_ready:
            raise RuntimeError("SentimentAnalyzer is not ready")
        
        if not message or not message.strip():
            raise ValueError("Message cannot be empty")
        
        try:
            # Run sentiment analysis in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, 
                self._analyze_text_sentiment, 
                message.strip()
            )
            
            logger.debug(f"Sentiment analysis completed for message: {message[:50]}...")
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing sentiment: {e}")
            raise RuntimeError(f"Sentiment analysis failed: {e}")
    
    def _analyze_text_sentiment(self, text: str) -> Dict[str, Any]:
        """
        Perform the actual sentiment analysis using TextBlob.
        
        Args:
            text: The text to analyze
            
        Returns:
            Dictionary with sentiment analysis results
        """
        blob = TextBlob(text)
        
        # Get polarity (-1 to 1) and subjectivity (0 to 1)
        polarity = blob.sentiment.polarity
        subjectivity = blob.sentiment.subjectivity
        
        # Determine sentiment label
        if polarity > 0.1:
            label = "positive"
        elif polarity < -0.1:
            label = "negative"
        else:
            label = "neutral"
        
        # Calculate confidence based on absolute polarity
        confidence = min(abs(polarity) + 0.1, 1.0)
        
        return {
            "score": round(polarity, 3),
            "label": label,
            "confidence": round(confidence, 3),
            "subjectivity": round(subjectivity, 3),
            "analyzed_at": datetime.utcnow().isoformat()
        }
    
    async def analyze_batch(self, messages: List[str]) -> List[Dict[str, Any]]:
        """
        Analyze sentiment for multiple messages in batch.
        
        Args:
            messages: List of message texts to analyze
            
        Returns:
            List of sentiment analysis results
            
        Raises:
            ValueError: If messages list is empty
            RuntimeError: If sentiment analysis fails
        """
        if not messages:
            raise ValueError("Messages list cannot be empty")
        
        if not self._is_ready:
            raise RuntimeError("SentimentAnalyzer is not ready")
        
        try:
            # Process messages concurrently
            tasks = [self.analyze_sentiment(msg) for msg in messages]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Handle any exceptions in results
            processed_results = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.warning(f"Failed to analyze message {i}: {result}")
                    processed_results.append({
                        "score": 0.0,
                        "label": "neutral",
                        "confidence": 0.0,
                        "subjectivity": 0.0,
                        "error": str(result),
                        "analyzed_at": datetime.utcnow().isoformat()
                    })
                else:
                    processed_results.append(result)
            
            logger.info(f"Batch sentiment analysis completed for {len(messages)} messages")
            return processed_results
            
        except Exception as e:
            logger.error(f"Error in batch sentiment analysis: {e}")
            raise RuntimeError(f"Batch sentiment analysis failed: {e}")
    
    def detect_triggers(self, sentiment_result: Dict[str, Any], message: str) -> List[str]:
        """
        Detect automation triggers based on sentiment analysis results.
        
        Args:
            sentiment_result: Result from analyze_sentiment()
            message: Original message text
            
        Returns:
            List of trigger names that should be activated
        """
        triggers = []
        
        try:
            score = sentiment_result.get("score", 0.0)
            label = sentiment_result.get("label", "neutral")
            confidence = sentiment_result.get("confidence", 0.0)
            
            # Negative sentiment trigger (score < -0.2 with reasonable confidence)
            if score < -0.2 and confidence > 0.3:
                triggers.append("negative_sentiment")
                logger.info(f"Negative sentiment trigger detected: score={score}, confidence={confidence}")
            
            # Very negative sentiment trigger (score < -0.5 with high confidence)
            if score < -0.5 and confidence > 0.5:
                triggers.append("very_negative_sentiment")
                logger.info(f"Very negative sentiment trigger detected: score={score}, confidence={confidence}")
            
            # Positive sentiment trigger (score > 0.3 with reasonable confidence)
            if score > 0.3 and confidence > 0.3:
                triggers.append("positive_sentiment")
                logger.debug(f"Positive sentiment trigger detected: score={score}, confidence={confidence}")
            
            # High emotion trigger (high subjectivity with strong sentiment)
            subjectivity = sentiment_result.get("subjectivity", 0.0)
            if subjectivity > 0.7 and abs(score) > 0.4:
                triggers.append("high_emotion")
                logger.info(f"High emotion trigger detected: subjectivity={subjectivity}, score={score}")
            
            return triggers
            
        except Exception as e:
            logger.error(f"Error detecting sentiment triggers: {e}")
            return []
    
    def get_service_info(self) -> Dict[str, Any]:
        """
        Get service information and status.
        
        Returns:
            Dictionary with service information
        """
        return {
            "service": "SentimentAnalyzer",
            "version": "1.0.0",
            "ready": self._is_ready,
            "backend": "TextBlob",
            "supported_triggers": [
                "NegativeSentiment",
                "VeryNegativeSentiment", 
                "PositiveSentiment",
                "HighEmotion"
            ],
            "score_range": [-1.0, 1.0],
            "confidence_range": [0.0, 1.0]
        }


# Global service instance
_sentiment_analyzer = None


def get_sentiment_analyzer() -> SentimentAnalyzer:
    """
    Get the global sentiment analyzer instance.
    
    Returns:
        SentimentAnalyzer instance
    """
    global _sentiment_analyzer
    
    if _sentiment_analyzer is None:
        _sentiment_analyzer = SentimentAnalyzer()
    
    return _sentiment_analyzer
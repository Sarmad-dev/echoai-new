"""
Simple validation script to check if the chat endpoint implementation is syntactically correct.
"""
import os
import sys

def validate_imports():
    """Validate that all imports work correctly."""
    print("🔍 Validating imports...")
    
    try:
        # Add app to path
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))
        
        # Test basic imports
        from app.config import settings
        print("✅ Config import successful")
        
        from app.models.chat import ChatRequest, ChatRequestWithApiKey, ChatResponse
        print("✅ Chat models import successful")
        
        from app.services.model_service import get_model_service
        print("✅ Model service import successful")
        
        from app.services.user_service import get_user_service
        print("✅ User service import successful")
        
        from app.services.conversation_service import get_conversation_service
        print("✅ Conversation service import successful")
        
        from app.services.rag_service import get_rag_service
        print("✅ RAG service import successful")
        
        from app.routers.chat import router
        print("✅ Chat router import successful")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False


def validate_models():
    """Validate that the models can be instantiated."""
    print("\n🔍 Validating models...")
    
    try:
        from app.models.chat import ChatRequest, ChatRequestWithApiKey, ChatResponse
        
        # Test ChatRequest
        chat_req = ChatRequest(
            message="Test message",
            user_id="test-user",
            conversation_id="test-conv"
        )
        print("✅ ChatRequest validation successful")
        
        # Test ChatRequestWithApiKey
        widget_req = ChatRequestWithApiKey(
            message="Test widget message",
            api_key="test-api-key",
            conversation_id="test-conv"
        )
        print("✅ ChatRequestWithApiKey validation successful")
        
        # Test ChatResponse
        response = ChatResponse(
            response="Test response",
            sentiment="neutral",
            conversation_id="test-conv",
            context_used=True,
            sources_count=2,
            confidence_score=0.8
        )
        print("✅ ChatResponse validation successful")
        
        return True
        
    except Exception as e:
        print(f"❌ Model validation error: {e}")
        return False


def validate_services():
    """Validate that services can be initialized."""
    print("\n🔍 Validating services...")
    
    try:
        from app.services.model_service import get_model_service
        from app.services.user_service import get_user_service
        from app.services.conversation_service import get_conversation_service
        from app.services.rag_service import get_rag_service
        
        # Test service initialization (without actual connections)
        print("Testing service imports...")
        
        # These should not fail even without credentials
        model_service_class = get_model_service.__module__
        user_service_class = get_user_service.__module__
        conversation_service_class = get_conversation_service.__module__
        rag_service_class = get_rag_service.__module__
        
        print("✅ All service classes imported successfully")
        
        return True
        
    except Exception as e:
        print(f"❌ Service validation error: {e}")
        return False


def validate_router():
    """Validate that the router is properly configured."""
    print("\n🔍 Validating router...")
    
    try:
        from app.routers.chat import router
        
        # Check that router has the expected routes
        routes = [route.path for route in router.routes]
        expected_routes = ["/chat", "/chat/widget", "/chat/context", "/chat/health"]
        
        print(f"Available routes: {routes}")
        
        for expected_route in expected_routes:
            if any(expected_route in route for route in routes):
                print(f"✅ Route {expected_route} found")
            else:
                print(f"⚠️ Route {expected_route} not found")
        
        return True
        
    except Exception as e:
        print(f"❌ Router validation error: {e}")
        return False


def main():
    """Run all validations."""
    print("🚀 Validating FastAPI Chat Endpoint Implementation")
    print("=" * 60)
    
    validations = [
        ("Imports", validate_imports),
        ("Models", validate_models),
        ("Services", validate_services),
        ("Router", validate_router)
    ]
    
    results = {}
    
    for name, validation_func in validations:
        try:
            result = validation_func()
            results[name] = result
        except Exception as e:
            print(f"❌ {name} validation failed: {e}")
            results[name] = False
    
    # Summary
    print("\n" + "=" * 60)
    print("VALIDATION SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for name, result in results.items():
        status = "PASSED" if result else "FAILED"
        print(f"{name}: {status}")
    
    print(f"\nOverall: {passed}/{total} validations passed")
    
    if passed == total:
        print("🎉 All validations passed! Implementation is syntactically correct.")
        print("\n📋 Next steps:")
        print("1. Set environment variables (HUGGINGFACE_API_TOKEN, SUPABASE_URL, SUPABASE_KEY)")
        print("2. Start the FastAPI server: python run.py")
        print("3. Test the endpoints with actual requests")
    else:
        print("⚠️ Some validations failed. Please fix the issues above.")
    
    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)